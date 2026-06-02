/**
 * MOP-0008 Addendum 1 — Shared web search client.
 *
 * Thin abstraction over a recipe-friendly web-search provider so the
 * `web_search_recipe` tool handler stays stable when the provider changes.
 *
 * Provider selection:
 *   - WEB_SEARCH_PROVIDER (default "tavily") — "tavily" | "brave" | "serper"
 *   - WEB_SEARCH_API_KEY                     — provider API key
 *
 * Capability gating:
 *   - `isConfigured()` returns `false` when the API key is unset. Callers
 *     (the catalog builder) should omit the `web_search_recipe` tool from
 *     the agent's tool list in that case rather than failing at call time.
 *
 * Security:
 *   - API key access is ISOLATED to this file. Handlers never read
 *     `WEB_SEARCH_API_KEY` directly.
 *   - Snippet text is third-party untrusted content. The caller wraps it in
 *     `<tool_result>` markers before feeding it to the model (agent-loop).
 */

export type WebSearchProvider = "tavily" | "brave" | "serper";

export interface WebSearchCandidate {
  title: string;
  url: string;
  source_domain: string;
  snippet: string;
}

export interface WebSearchQuery {
  query: string;
  maxResults?: number;
  siteFilter?: string;
}

export type WebSearchOutcome =
  | {
      ok: true;
      data: {
        candidates: WebSearchCandidate[];
        provider: WebSearchProvider;
      };
    }
  | {
      ok: false;
      error:
        | "PROVIDER_UNAVAILABLE"
        | "RATE_LIMITED"
        | "NO_RESULTS"
        | "PROVIDER_NOT_CONFIGURED";
      retryable: boolean;
    };

const DEFAULT_PROVIDER: WebSearchProvider = "tavily";

function getProvider(): WebSearchProvider {
  const raw = (Deno.env.get("WEB_SEARCH_PROVIDER") || DEFAULT_PROVIDER).toLowerCase();
  if (raw === "tavily" || raw === "brave" || raw === "serper") return raw;
  return DEFAULT_PROVIDER;
}

function getApiKey(): string | undefined {
  const k = Deno.env.get("WEB_SEARCH_API_KEY");
  return k && k.length > 0 ? k : undefined;
}

/** Capability gate — used by the catalog builder to omit the tool entirely. */
export function isConfigured(): boolean {
  return !!getApiKey();
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function clampSnippet(s: string | undefined | null): string {
  if (!s) return "";
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
}

// ─────────────────────────────────────────────────────────────────────
// Tavily — default provider. POST https://api.tavily.com/search
// ─────────────────────────────────────────────────────────────────────

async function searchTavily(
  apiKey: string,
  q: WebSearchQuery
): Promise<WebSearchOutcome> {
  const max = Math.min(Math.max(q.maxResults ?? 3, 1), 5);
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query: q.query,
    max_results: max,
    search_depth: "basic",
    include_answer: false,
  };
  if (q.siteFilter) {
    body.include_domains = [q.siteFilter];
  }

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  if (response.status === 429) {
    return { ok: false, error: "RATE_LIMITED", retryable: true };
  }
  if (!response.ok) {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];
  const candidates: WebSearchCandidate[] = rawResults
    .map((r) => ({
      title: String(r.title || "").trim(),
      url: String(r.url || "").trim(),
      source_domain: safeHost(String(r.url || "")),
      snippet: clampSnippet(r.content || r.snippet),
    }))
    .filter((c) => c.url && c.title)
    .slice(0, max);

  if (candidates.length === 0) {
    return { ok: false, error: "NO_RESULTS", retryable: false };
  }

  return { ok: true, data: { candidates, provider: "tavily" } };
}

// ─────────────────────────────────────────────────────────────────────
// Brave Search — GET https://api.search.brave.com/res/v1/web/search
// ─────────────────────────────────────────────────────────────────────

async function searchBrave(
  apiKey: string,
  q: WebSearchQuery
): Promise<WebSearchOutcome> {
  const max = Math.min(Math.max(q.maxResults ?? 3, 1), 5);
  const params = new URLSearchParams({
    q: q.siteFilter ? `site:${q.siteFilter} ${q.query}` : q.query,
    count: String(max),
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(15_000),
      }
    );
  } catch {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  if (response.status === 429) {
    return { ok: false, error: "RATE_LIMITED", retryable: true };
  }
  if (!response.ok) {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  const rawResults: any[] = Array.isArray(data?.web?.results) ? data.web.results : [];
  const candidates: WebSearchCandidate[] = rawResults
    .map((r) => ({
      title: String(r.title || "").trim(),
      url: String(r.url || "").trim(),
      source_domain: safeHost(String(r.url || "")),
      snippet: clampSnippet(r.description),
    }))
    .filter((c) => c.url && c.title)
    .slice(0, max);

  if (candidates.length === 0) {
    return { ok: false, error: "NO_RESULTS", retryable: false };
  }

  return { ok: true, data: { candidates, provider: "brave" } };
}

// ─────────────────────────────────────────────────────────────────────
// Serper — POST https://google.serper.dev/search
// ─────────────────────────────────────────────────────────────────────

async function searchSerper(
  apiKey: string,
  q: WebSearchQuery
): Promise<WebSearchOutcome> {
  const max = Math.min(Math.max(q.maxResults ?? 3, 1), 5);
  const body: Record<string, unknown> = {
    q: q.siteFilter ? `site:${q.siteFilter} ${q.query}` : q.query,
    num: max,
  };

  let response: Response;
  try {
    response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  if (response.status === 429) {
    return { ok: false, error: "RATE_LIMITED", retryable: true };
  }
  if (!response.ok) {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true };
  }

  const rawResults: any[] = Array.isArray(data?.organic) ? data.organic : [];
  const candidates: WebSearchCandidate[] = rawResults
    .map((r) => ({
      title: String(r.title || "").trim(),
      url: String(r.link || "").trim(),
      source_domain: safeHost(String(r.link || "")),
      snippet: clampSnippet(r.snippet),
    }))
    .filter((c) => c.url && c.title)
    .slice(0, max);

  if (candidates.length === 0) {
    return { ok: false, error: "NO_RESULTS", retryable: false };
  }

  return { ok: true, data: { candidates, provider: "serper" } };
}

// ─────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────

export const webSearch = {
  isConfigured,
  provider: getProvider,
  async query(q: WebSearchQuery): Promise<WebSearchOutcome> {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        ok: false,
        error: "PROVIDER_NOT_CONFIGURED",
        retryable: false,
      };
    }
    const provider = getProvider();
    if (provider === "brave") return searchBrave(apiKey, q);
    if (provider === "serper") return searchSerper(apiKey, q);
    return searchTavily(apiKey, q);
  },
};
