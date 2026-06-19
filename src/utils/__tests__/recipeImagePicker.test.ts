import { describe, expect, it } from "vitest";
import { pickBestFrameDataUrl } from "../recipeImagePicker";

describe("pickBestFrameDataUrl", () => {
  it("returns undefined for empty frames", async () => {
    expect(await pickBestFrameDataUrl([])).toBeUndefined();
  });

  it("returns the only frame without scoring", async () => {
    const frame = "data:image/jpeg;base64,abc";
    expect(await pickBestFrameDataUrl([frame])).toBe(frame);
  });
});
