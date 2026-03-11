import type { IntermediateContent } from "./types.ts";

const ADAPTER_VERSION = "1.0.0";

/**
 * Text adapter — the simplest path.
 * Normalizes whitespace and passes through text + optional images.
 */
export async function textAdapter(
  text: string,
  images?: string[]
): Promise<IntermediateContent> {
  const cleaned = (text || "").trim();

  if (!cleaned && (!images || images.length === 0)) {
    throw new Error("Text adapter requires text content or images");
  }

  return {
    raw_text: cleaned,
    images: (images || []).slice(0, 4),
    source_metadata: {
      source_type: "text",
      extracted_at: new Date().toISOString(),
      adapter_version: ADAPTER_VERSION,
    },
  };
}
