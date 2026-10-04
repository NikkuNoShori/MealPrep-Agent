import { describe, expect, it, beforeEach } from "vitest";
import { buildDraftRecipeKey, useDraftRecipeStore } from "../draftRecipeStore";

describe("draftRecipeStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useDraftRecipeStore.setState({ drafts: {} });
  });

  it("buildDraftRecipeKey is stable per conversation/message/slot", () => {
    expect(buildDraftRecipeKey("conv-1", "msg-1", 0)).toBe("conv-1:msg-1:0");
    expect(buildDraftRecipeKey("conv-1", "msg-1", 1)).toBe("conv-1:msg-1:1");
  });

  it("persists recipe edits without previewImageDataUrl in sessionStorage", () => {
    useDraftRecipeStore.getState().upsertDraft("conv:msg:0", {
      conversationId: "conv",
      messageId: "msg",
      recipeIndex: 0,
      recipe: {
        title: "Pasta",
        ingredients: [{ name: "noodles", amount: 1, unit: "lb", category: "other" }],
        instructions: ["Boil"],
      },
      previewImageDataUrl: "data:image/jpeg;base64,abc",
      thumbnailUrl: "https://example.com/thumb.jpg",
    });

    const stored = sessionStorage.getItem("mealprep:draft-recipes-v1");
    expect(stored).toBeTruthy();
    expect(stored).not.toContain("base64");
    expect(stored).toContain("https://example.com/thumb.jpg");

    expect(useDraftRecipeStore.getState().getDraft("conv:msg:0")?.previewImageDataUrl).toBe(
      "data:image/jpeg;base64,abc"
    );
  });

  it("remaps draft keys when message ids change after DB refresh", () => {
    useDraftRecipeStore.getState().upsertDraft("conv:temp-msg:0", {
      conversationId: "conv",
      messageId: "temp-msg",
      recipeIndex: 0,
      recipe: {
        title: "Soup",
        ingredients: [{ name: "broth", amount: 2, unit: "cups", category: "other" }],
        instructions: ["Simmer"],
      },
    });

    useDraftRecipeStore.getState().remapConversationDrafts("conv", [
      { messageId: "db-msg-uuid", recipeIndex: 0 },
    ]);

    expect(useDraftRecipeStore.getState().getDraft("conv:temp-msg:0")).toBeUndefined();
    expect(useDraftRecipeStore.getState().getDraft("conv:db-msg-uuid:0")?.recipe.title).toBe(
      "Soup"
    );
  });
});
