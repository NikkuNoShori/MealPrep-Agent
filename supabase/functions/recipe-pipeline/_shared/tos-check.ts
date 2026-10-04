/**
 * MOP-0027 — ToS Compliance Utilities
 *
 * Two checks run before the URL adapter fetches a recipe page:
 *
 *  1. Domain blocklist  — hard-no sites whose ToS explicitly prohibit scraping.
 *     Zero network cost; purely in-memory lookup.
 *
 *  2. robots.txt check  — checks whether the target path is Disallowed for
 *     User-agent: * (or Googlebot as a common proxy). Fails OPEN on any
 *     network/parse error so a transient failure never blocks a legitimate
 *     extraction.
 *
 * Usage:
 *   const block = checkBlocklist(url);
 *   if (block) return tosBlockedError(block.reason);
 *
 *   const robots = await checkRobotsTxt(url);
 *   if (!robots.allowed) return tosBlockedError(robots.reason!);
 */

// ---------------------------------------------------------------------------
// Blocklist
// ---------------------------------------------------------------------------

interface BlockedDomain {
  domain: string;
  reason: string;
}

// Imported at module load time — parsed once, shared across all invocations
// within this edge function instance.
import BLOCKED_DOMAINS_RAW from "./blocked-domains.json" assert { type: "json" };
const BLOCKED_DOMAINS: BlockedDomain[] = BLOCKED_DOMAINS_RAW as BlockedDomain[];

/**
 * Returns the matching blocklist entry if the URL's hostname is blocked,
 * or null if the URL is allowed.
 */
export function checkBlocklist(url: string): BlockedDomain | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null; // malformed URL — let the adapter handle it
  }

  return (
    BLOCKED_DOMAINS.find(
      (entry) =>
        hostname === entry.domain.toLowerCase() ||
        hostname.endsWith("." + entry.domain.toLowerCase()),
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// robots.txt checker
// ---------------------------------------------------------------------------

const ROBOTS_UA = "MealPrepAgent";

/** Per-invocation cache: domain → parsed rules. Avoids repeat fetches for
 *  batch imports that hit multiple URLs from the same domain. */
const robotsCache = new Map<string, RobotsRules>();

interface RobotsRules {
  disallowedPaths: string[];
}

async function fetchRobots(domain: string): Promise<RobotsRules | null> {
  try {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { "User-Agent": ROBOTS_UA },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return parseRobots(text);
  } catch {
    return null; // network error → fail open
  }
}

function parseRobots(text: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  const disallowedPaths: string[] = [];

  let applicable = false; // are we inside a block that applies to us?

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#") || line === "") continue;

    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();

    if (field.toLowerCase() === "user-agent") {
      // Start a new agent block — check if it applies to us
      const agent = value.toLowerCase();
      applicable = agent === "*" || agent === "googlebot" || agent === ROBOTS_UA.toLowerCase();
    } else if (applicable && field.toLowerCase() === "disallow") {
      if (value) disallowedPaths.push(value);
    }
  }

  return { disallowedPaths };
}

function isPathDisallowed(path: string, rules: RobotsRules): boolean {
  for (const disallowed of rules.disallowedPaths) {
    if (path.startsWith(disallowed)) return true;
  }
  return false;
}

/**
 * Checks robots.txt for the given URL.
 * Always fails open — if we can't fetch/parse robots.txt, we allow.
 */
export async function checkRobotsTxt(
  url: string,
): Promise<{ allowed: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: true }; // malformed URL — let the adapter handle it
  }

  const domain = parsed.hostname.toLowerCase();
  const path = parsed.pathname || "/";

  // Check cache first
  let rules = robotsCache.get(domain);
  if (!rules) {
    const fetched = await fetchRobots(domain);
    if (!fetched) {
      // Fetch/parse failed — fail open
      return { allowed: true };
    }
    rules = fetched;
    robotsCache.set(domain, rules);
  }

  const disallowed = isPathDisallowed(path, rules);
  if (disallowed) {
    return {
      allowed: false,
      reason:
        "This site's robots.txt doesn't allow automated access. Copy the recipe text and paste it instead — it works just as well.",
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Shared error shape
// ---------------------------------------------------------------------------

/**
 * Returns a pipeline-compatible error object for ToS/robots blocks.
 * Matches the shape the pipeline propagates to the frontend
 * (errors[0].message is surfaced in both single-URL and batch import cards).
 */
export function tosBlockedError(reason: string): {
  success: false;
  errors: [{ stage: string; code: string; message: string }];
  stage_failed: string;
} {
  return {
    success: false,
    errors: [
      {
        stage: "fetch",
        code: "TOS_BLOCKED",
        message: reason,
      },
    ],
    stage_failed: "fetch",
  };
}
