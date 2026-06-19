/**
 * OpenRouter API key routing — chat vs media (non-chat) billing split.
 *
 * CHAT: agent tool loop, conversation title, substitution tool.
 * MEDIA: recipe pipeline, vision/OCR, Whisper, embeddings, extract, fallbacks.
 *
 * Legacy names remain supported for migration.
 */

export interface OpenRouterKeyPair {
  chat: string;
  media: string;
}

const CHAT_ENV_NAMES = [
  "OPENROUTER_API_KEY_CHAT",
  "OPENROUTER_API_KEY_TEXT",
  "OPENROUTER_API_KEY_QWEN2.5_instruct_8b",
  "OPENROUTER_API_KEY_QWEN2_5_instruct_8b",
] as const;

const MEDIA_ENV_NAMES = [
  "OPENROUTER_API_KEY_MEDIA",
  "OPENROUTER_API_KEY_VISION",
  "OPENROUTER_API_KEY_QWEN2.5_VL_8b",
  "OPENROUTER_API_KEY_QWEN2_5_VL_8b",
] as const;

function firstSet(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Resolve chat + media keys. Falls back to OPENROUTER_API_KEY for either side if unset. */
export function resolveOpenRouterKeys(): OpenRouterKeyPair {
  const fallback = Deno.env.get("OPENROUTER_API_KEY")?.trim();
  const chat = firstSet(CHAT_ENV_NAMES) ?? fallback;
  const media = firstSet(MEDIA_ENV_NAMES) ?? fallback;

  if (!chat || !media) {
    throw new Error(
      "OpenRouter not configured. Set OPENROUTER_API_KEY_CHAT and OPENROUTER_API_KEY_MEDIA " +
        "(or OPENROUTER_API_KEY as fallback for both)."
    );
  }

  return { chat, media };
}

export function resolveMediaApiKey(): string {
  return resolveOpenRouterKeys().media;
}

export function resolveChatApiKey(): string {
  return resolveOpenRouterKeys().chat;
}
