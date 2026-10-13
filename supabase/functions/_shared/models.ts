/**
 * Single source of truth for every OpenRouter model slug used across chat-api
 * and recipe-pipeline. Each token has an optional env-var override so an
 * operator can hot-swap a model (e.g. on deprecation) without a redeploy —
 * but the override var name is declared right next to the default here, so
 * it's discoverable instead of buried in whichever file happens to call
 * Deno.env.get().
 *
 * If OpenRouter deprecates a model, update the default below AND clear any
 * matching env override (`supabase secrets unset <VAR>`) — the env var wins
 * over this file's default, so leaving a stale override set will silently
 * reintroduce the old slug.
 */

function resolveModel(envVar: string, fallback: string): string {
  return Deno.env.get(envVar)?.trim() || fallback;
}

function resolveModelList(envVar: string, fallback: readonly string[]): string[] {
  const fromEnv = Deno.env.get(envVar)
    ?.split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : [...fallback];
}

/** Agent loop's primary tool-calling model (chat-api). Requires function-calling support. */
export const AGENT_MODEL = resolveModel("OPENROUTER_AGENT_MODEL", "qwen/qwen3.7-plus");

/**
 * Fallback chain tried after AGENT_MODEL on a retryable failure (429/502/503/no-endpoints).
 * Every entry must advertise `tools` support — vision-only models are NOT valid here.
 */
export const AGENT_MODEL_FALLBACKS = resolveModelList("OPENROUTER_AGENT_MODEL_FALLBACKS", [
  "qwen/qwen3.7-plus",
  "openai/gpt-4o-mini",
] as const);

/** Cheap text model for one-shot, non-conversational jobs (titles, substitution lookup). */
export const UTILITY_TEXT_MODEL = resolveModel("OPENROUTER_UTILITY_MODEL", "qwen/qwen-2.5-7b-instruct");

/** Default model for OpenRouterClient.chat / chatWithHistory / chatWithTools call sites that don't pass one explicitly. */
export const DEFAULT_CHAT_MODEL = resolveModel("OPENROUTER_CHAT_MODEL", "qwen/qwen3.7-plus");

/**
 * Vision models tried in order for image-based recipe extraction
 * (recipe-pipeline extract.ts) and video-frame OCR (video-adapter.ts).
 * Each entry must accept image input.
 */
export const VISION_MODELS = resolveModelList("OPENROUTER_VISION_MODELS", [
  "qwen/qwen3-vl-8b-instruct",     // Qwen3 VL 8B — successor to retired qwen-2.5-vl-7b
  "qwen/qwen2.5-vl-72b-instruct",  // Qwen2.5 VL 72B — quality fallback (larger, slower)
  "google/gemini-2.0-flash-001",   // Google fallback
] as const);

/** Primary single-shot vision model (OpenRouterClient.chatWithImages default, video OCR). */
export const VISION_MODEL = VISION_MODELS[0];

/** Primary audio transcription model (transcribe-media.ts), via OpenRouter's /audio/transcriptions endpoint. */
export const WHISPER_MODEL = resolveModel("OPENROUTER_WHISPER_MODEL", "openai/whisper-large-v3");

/** Fallback audio transcription model (transcribe-media.ts) when the Whisper endpoint fails — routed via the multimodal chat endpoint, not /audio/transcriptions. Must accept audio input. */
export const TRANSCRIPTION_MODEL = resolveModel("OPENROUTER_TRANSCRIPTION_MODEL", "google/gemini-2.5-flash");
