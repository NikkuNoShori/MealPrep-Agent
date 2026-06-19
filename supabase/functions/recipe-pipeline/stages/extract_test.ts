import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { IntermediateContent } from "../../_shared/recipe-schema.ts";
import { shouldUseVisionExtract } from "./extract.ts";

function videoContent(
  rawText: string,
  images: string[] = []
): IntermediateContent {
  return {
    raw_text: rawText,
    images,
    source_metadata: {
      source_type: "video",
      source_url: "https://www.tiktok.com/@x/video/1",
      source_name: "tiktok.com",
      extracted_at: new Date().toISOString(),
      adapter_version: "1.1.0",
    },
  };
}

Deno.test("video with oEmbed caption uses text extract, not vision", () => {
  const content = videoContent(
    "Video Caption:\nHigh protein chicken bowl — 1 cup rice, 2 chicken breasts, bake 400F 25 min",
    ["https://p16-sign.tiktokcdn.com/thumb.jpg"]
  );
  assertEquals(shouldUseVisionExtract(content), false);
});

Deno.test("video with only thumbnail and no text uses vision", () => {
  const content = videoContent("", ["data:image/jpeg;base64,abc"]);
  assertEquals(shouldUseVisionExtract(content), true);
});

Deno.test("text source with attached image uses vision", () => {
  const content: IntermediateContent = {
    raw_text: "",
    images: ["data:image/jpeg;base64,abc"],
    source_metadata: {
      source_type: "text",
      extracted_at: new Date().toISOString(),
      adapter_version: "1.0.0",
    },
  };
  assertEquals(shouldUseVisionExtract(content), true);
});

Deno.test("url source never uses vision in extract stage", () => {
  const content: IntermediateContent = {
    raw_text: "Recipe from JSON-LD",
    images: ["https://example.com/photo.jpg"],
    source_metadata: {
      source_type: "url",
      source_url: "https://example.com/recipe",
      source_name: "example.com",
      extracted_at: new Date().toISOString(),
      adapter_version: "1.0.0",
    },
  };
  assertEquals(shouldUseVisionExtract(content), false);
});
