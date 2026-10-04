/**
 * MOP-0008 — Tool dispatcher.
 *
 * Validates arguments against the tool's JSON Schema (60-line subset),
 * rejects any `user_id` key as a hard safety net, short-circuits destructive
 * tools with a confirmation envelope, and invokes the handler under the
 * user-scoped Supabase client.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";
import {
  CONDITIONALLY_DESTRUCTIVE,
  DESTRUCTIVE_TOOLS,
  findCatalogEntry,
} from "./catalog.ts";
import { HANDLERS, type ToolHandler } from "./handlers.ts";

export interface ToolContext {
  user: { id: string; email?: string };
  supabase: SupabaseClient;
  openRouter: OpenRouterClient;
  userToken: string;
  /** Base64 data URLs attached to the current user turn (for extract_recipe_from_source). */
  attachedImages?: string[];
  /** User-uploaded video public URL for transcription (recipe intake). */
  attachedVideoMediaUrl?: string;
  /** Keyframe data URLs from client-side video extraction. */
  attachedVideoFrameUrls?: string[];
}

export type ToolResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      details?: unknown;
    }
  | {
      ok: true;
      requiresConfirmation: true;
      summary: string;
      tool: string;
      args: Record<string, unknown>;
      idempotencyKey: string;
    };

// ─────────────────────────────────────────────────────────────────────
// Tiny JSON Schema subset validator (~60 lines)
// Supports: type (string,number,integer,boolean,object,array),
// required, properties, additionalProperties:false, enum, minimum,
// maximum, minLength, minItems, maxItems, minProperties, format
// (uuid/date/uri — surface check only), items.
// ─────────────────────────────────────────────────────────────────────

type JsonSchema = Record<string, any>;

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path = ""
): string[] {
  const errs: string[] = [];
  const at = (p: string) => (p ? `${path}.${p}` : path || "<root>");
  const t = schema.type;

  if (t === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errs.push(`${at("")}: expected object`);
      return errs;
    }
    const obj = value as Record<string, unknown>;
    const props = (schema.properties || {}) as Record<string, JsonSchema>;
    const required: string[] = schema.required || [];
    for (const r of required) {
      if (!(r in obj)) errs.push(`${at(r)}: required`);
    }
    if (schema.minProperties && Object.keys(obj).length < schema.minProperties) {
      errs.push(`${at("")}: requires >= ${schema.minProperties} properties`);
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(obj)) {
        if (!(k in props)) errs.push(`${at(k)}: unknown property`);
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) errs.push(...validateAgainstSchema(v, props[k], at(k)));
    }
    return errs;
  }
  if (t === "array") {
    if (!Array.isArray(value)) {
      errs.push(`${at("")}: expected array`);
      return errs;
    }
    if (schema.minItems && value.length < schema.minItems) {
      errs.push(`${at("")}: requires >= ${schema.minItems} items`);
    }
    if (schema.maxItems && value.length > schema.maxItems) {
      errs.push(`${at("")}: requires <= ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, i) =>
        errs.push(...validateAgainstSchema(item, schema.items, `${path}[${i}]`))
      );
    }
    return errs;
  }
  if (t === "string") {
    if (typeof value !== "string") {
      errs.push(`${at("")}: expected string`);
      return errs;
    }
    if (schema.minLength && value.length < schema.minLength) {
      errs.push(`${at("")}: requires length >= ${schema.minLength}`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errs.push(`${at("")}: must be one of ${schema.enum.join(", ")}`);
    }
    if (schema.format === "uuid" && !UUID_RE.test(value)) {
      errs.push(`${at("")}: must be a UUID`);
    }
    if (schema.format === "date" && !DATE_RE.test(value)) {
      errs.push(`${at("")}: must be YYYY-MM-DD`);
    }
    if (schema.format === "uri") {
      try {
        new URL(value);
      } catch {
        errs.push(`${at("")}: must be a valid URL`);
      }
    }
    return errs;
  }
  if (t === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      errs.push(`${at("")}: expected integer`);
      return errs;
    }
    if (schema.minimum !== undefined && value < schema.minimum)
      errs.push(`${at("")}: must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errs.push(`${at("")}: must be <= ${schema.maximum}`);
    return errs;
  }
  if (t === "number") {
    if (typeof value !== "number") {
      errs.push(`${at("")}: expected number`);
      return errs;
    }
    if (schema.minimum !== undefined && value < schema.minimum)
      errs.push(`${at("")}: must be >= ${schema.minimum}`);
    return errs;
  }
  if (t === "boolean") {
    if (typeof value !== "boolean") errs.push(`${at("")}: expected boolean`);
    return errs;
  }
  return errs;
}

/** Recursively scan a value for the literal key `user_id`. */
function containsUserIdKey(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUserIdKey);
  const obj = value as Record<string, unknown>;
  if ("user_id" in obj) return true;
  return Object.values(obj).some(containsUserIdKey);
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────

function makeIdempotencyKey(name: string, args: unknown): string {
  // Cheap deterministic key — not cryptographic. Used by the UI to
  // deduplicate "confirm" rerequests.
  const json = JSON.stringify({ name, args });
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    h = (Math.imul(31, h) + json.charCodeAt(i)) | 0;
  }
  return `${name}:${Math.abs(h).toString(36)}`;
}

function summarizeForConfirmation(
  name: string,
  args: Record<string, unknown>
): string {
  switch (name) {
    case "delete_recipe":
      return `Delete recipe ${args.recipe_id}?`;
    case "update_recipe":
      return `Update recipe ${args.recipe_id} with ${JSON.stringify(args.changes ?? {})}?`;
    case "assign_recipe_to_meal_plan_slot":
      return `Overwrite ${args.slot} on ${args.date} with recipe ${args.recipe_id}?`;
    case "update_member_allergens": {
      const add = (args.add as string[] | undefined) ?? [];
      const remove = (args.remove as string[] | undefined) ?? [];
      const parts: string[] = [];
      if (add.length) parts.push(`add: ${add.join(", ")}`);
      if (remove.length) parts.push(`remove: ${remove.join(", ")}`);
      return `Update ${args.member_name}'s allergens — ${parts.join("; ")}?`;
    }
    default:
      return `Confirm ${name}?`;
  }
}

export async function dispatchTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext
): Promise<ToolResult> {
  // 1. Look up catalog entry.
  const entry = findCatalogEntry(name);
  if (!entry) {
    return {
      ok: false,
      error: `Unknown tool: ${name}`,
      retryable: false,
    };
  }

  // 2. Coerce args.
  let args: Record<string, unknown>;
  if (rawArgs === null || rawArgs === undefined) {
    args = {};
  } else if (typeof rawArgs === "string") {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return {
        ok: false,
        error: `Could not parse tool arguments as JSON for ${name}`,
        retryable: true,
      };
    }
  } else if (typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    args = rawArgs as Record<string, unknown>;
  } else {
    return {
      ok: false,
      error: `Tool arguments must be an object for ${name}`,
      retryable: false,
    };
  }

  // 3. Hard safety net: reject user_id anywhere in the args tree.
  if (containsUserIdKey(args)) {
    console.warn(
      `[dispatchTool] rejecting tool call ${name} — args contained user_id`,
      { args }
    );
    return {
      ok: false,
      error:
        "Tool arguments must not contain `user_id`. The user is resolved from the authenticated session.",
      retryable: false,
    };
  }

  // 4. Validate args against the tool's JSON Schema.
  const schema = entry.spec.function.parameters as JsonSchema;
  const argErrs = validateAgainstSchema(args, schema);
  if (argErrs.length > 0) {
    return {
      ok: false,
      error: `Invalid arguments for ${name}: ${argErrs.join("; ")}`,
      retryable: true,
      details: argErrs,
    };
  }

  // 5. Destructive short-circuit.
  if (DESTRUCTIVE_TOOLS.has(name)) {
    return {
      ok: true,
      requiresConfirmation: true,
      summary: summarizeForConfirmation(name, args),
      tool: name,
      args,
      idempotencyKey: makeIdempotencyKey(name, args),
    };
  }

  // 6. Look up handler.
  const handler: ToolHandler | undefined = HANDLERS[name];
  if (!handler) {
    return {
      ok: false,
      error: `No handler implemented for ${name}`,
      retryable: false,
    };
  }

  // 7. Execute.
  let raw: unknown;
  try {
    raw = await handler(args, ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[dispatchTool] handler ${name} threw:`, msg);
    return {
      ok: false,
      error: `${name} failed: ${msg}`,
      retryable: true,
    };
  }

  // 8. Handlers may surface their own confirmation requirement
  //    (e.g. conditional-destructive when a slot is occupied).
  if (
    raw &&
    typeof raw === "object" &&
    "requiresConfirmation" in (raw as Record<string, unknown>)
  ) {
    const r = raw as {
      requiresConfirmation: true;
      summary?: string;
      args?: Record<string, unknown>;
    };
    if (!CONDITIONALLY_DESTRUCTIVE.has(name)) {
      console.warn(
        `[dispatchTool] handler ${name} returned requiresConfirmation but is not in CONDITIONALLY_DESTRUCTIVE`
      );
    }
    return {
      ok: true,
      requiresConfirmation: true,
      summary: r.summary || summarizeForConfirmation(name, args),
      tool: name,
      args: r.args || args,
      idempotencyKey: makeIdempotencyKey(name, args),
    };
  }

  // 9. Validate handler output is JSON-serializable. If a handler returned
  //    `{ ok: false, ... }` we preserve the shape.
  if (
    raw &&
    typeof raw === "object" &&
    "ok" in (raw as Record<string, unknown>) &&
    (raw as { ok: boolean }).ok === false
  ) {
    const e = raw as { ok: false; error: string; retryable?: boolean };
    return {
      ok: false,
      error: e.error || `${name} failed`,
      retryable: e.retryable ?? true,
    };
  }

  // Unwrap handler envelope. Handlers return { ok: true, data: payload };
  // returning { ok: true, data: raw } would nest payload one level too deep,
  // making result.data.recipe undefined in agent-loop.ts and preventing
  // StructuredRecipeDisplay from ever mounting. The ok:false branch above
  // already passes through correctly — this mirrors that behaviour for ok:true.
  const payload =
    raw &&
    typeof raw === "object" &&
    "ok" in (raw as Record<string, unknown>) &&
    (raw as { ok: unknown }).ok === true &&
    "data" in (raw as Record<string, unknown>)
      ? (raw as { ok: true; data: unknown }).data
      : raw;
  return { ok: true, data: payload };
}
