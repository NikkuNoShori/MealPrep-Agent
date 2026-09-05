/**
 * MOP-0019 — Batch Recipe Import
 *
 * Accepts up to 50 URLs, fires parallel extraction via recipe-pipeline/extract-only,
 * and streams SSE progress events as each URL resolves. URLs > WAVE_SIZE are chunked
 * into sequential waves to stay within Supabase's 150s wall-clock ceiling.
 *
 * SSE event types:
 *   {type:"progress", index, total, url, status:"extracting"}
 *   {type:"result",   index, url, recipe}
 *   {type:"error",    index, url, message}
 *   {type:"done",     total, succeeded, failed}
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Maximum URLs in one parallel wave — keeps total time ≤ 150s wall-clock.
const WAVE_SIZE = 10;
const MAX_URLS = 50;
// Per-URL extraction timeout (ms). recipe-pipeline/extract-only is typically 5–15s.
const PER_URL_TIMEOUT_MS = 50_000;

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type BatchSSEEvent =
  | { type: "progress"; index: number; total: number; url: string; status: "extracting" }
  | { type: "result";   index: number; url: string; recipe: unknown }
  | { type: "error";    index: number; url: string; message: string }
  | { type: "done";     total: number; succeeded: number; failed: number };

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function sseFrame(data: BatchSSEEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Parse the raw body URLs: split on whitespace/commas, trim, dedupe, validate. */
export function parseUrls(raw: unknown): { urls: string[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { urls: [], error: "urls must be an array of strings" };
  }
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    if (!isValidUrl(trimmed)) continue;
    valid.push(trimmed);
  }
  if (valid.length === 0) {
    return { urls: [], error: "No valid URLs provided" };
  }
  if (valid.length > MAX_URLS) {
    return { urls: valid.slice(0, MAX_URLS), error: undefined }; // silently cap
  }
  return { urls: valid };
}

// ─────────────────────────────────────────────────────────────────────
// Single-URL extraction
// ─────────────────────────────────────────────────────────────────────

async function extractOne(
  url: string,
  userToken: string,
  supabaseUrl: string,
): Promise<{ ok: true; recipe: unknown } | { ok: false; message: string }> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/recipe-pipeline/extract-only`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ source_type: "url", url, auto_save: false }),
        signal: AbortSignal.timeout(PER_URL_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        message: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const recipe = data?.recipe ?? data?.data?.recipe ?? data;
    return { ok: true, recipe };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg.slice(0, 300) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────

export async function handleBatchExtract(
  req: Request,
  _supabase: SupabaseClient,
  _user: { id: string },
  userToken: string,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { urls, error: parseError } = parseUrls(body.urls);
  if (parseError && urls.length === 0) {
    return new Response(
      JSON.stringify({ error: parseError }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const total = urls.length;
  let succeeded = 0;
  let failed = 0;

  // Stream SSE to the client while extraction runs in waves.
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: BatchSSEEvent) => {
        try { controller.enqueue(sseFrame(event)); } catch { /* closed */ }
      };

      // Chunk urls into waves of WAVE_SIZE.
      const waves: string[][] = [];
      for (let i = 0; i < urls.length; i += WAVE_SIZE) {
        waves.push(urls.slice(i, i + WAVE_SIZE));
      }

      let globalIndex = 0;

      for (const wave of waves) {
        // Emit "extracting" progress for each URL in this wave.
        for (const url of wave) {
          enqueue({ type: "progress", index: globalIndex + wave.indexOf(url), total, url, status: "extracting" });
        }

        // Fire all URLs in this wave in parallel.
        const waveResults = await Promise.allSettled(
          wave.map((url) => extractOne(url, userToken, supabaseUrl)),
        );

        // Stream results as they resolve (allSettled resolves all at once per wave,
        // but within a wave they're concurrent — order matches input).
        for (let i = 0; i < wave.length; i++) {
          const idx = globalIndex + i;
          const url = wave[i];
          const settled = waveResults[i];

          if (settled.status === "fulfilled" && settled.value.ok) {
            succeeded++;
            enqueue({ type: "result", index: idx, url, recipe: settled.value.recipe });
          } else {
            failed++;
            const message = settled.status === "rejected"
              ? String(settled.reason)
              : (settled.value as { ok: false; message: string }).message;
            enqueue({ type: "error", index: idx, url, message });
          }
        }

        globalIndex += wave.length;
      }

      enqueue({ type: "done", total, succeeded, failed });
      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}
