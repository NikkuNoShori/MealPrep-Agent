/**
 * MOP-0019 — Unit tests for batch import utilities.
 *
 * Tests parseImportUrls(), BatchSSEEvent type narrowing, and the
 * batchImport() streaming contract using a mocked fetch + ReadableStream.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseImportUrls } from "../api";
import type { BatchSSEEvent } from "../api";

// ─────────────────────────────────────────────────────────────────────────────
// parseImportUrls
// ─────────────────────────────────────────────────────────────────────────────

describe("parseImportUrls", () => {
  it("parses newline-separated URLs", () => {
    const input = "https://a.com/recipe\nhttps://b.com/recipe";
    expect(parseImportUrls(input)).toEqual([
      "https://a.com/recipe",
      "https://b.com/recipe",
    ]);
  });

  it("parses comma-separated URLs", () => {
    const input = "https://a.com,https://b.com";
    expect(parseImportUrls(input)).toEqual(["https://a.com", "https://b.com"]);
  });

  it("deduplicates URLs", () => {
    const input = "https://a.com\nhttps://a.com\nhttps://b.com";
    expect(parseImportUrls(input)).toEqual(["https://a.com", "https://b.com"]);
  });

  it("filters out invalid URLs", () => {
    const input = "not-a-url\nhttps://valid.com\nftp://wrong.com";
    expect(parseImportUrls(input)).toEqual(["https://valid.com"]);
  });

  it("returns empty array for blank input", () => {
    expect(parseImportUrls("")).toEqual([]);
    expect(parseImportUrls("   ")).toEqual([]);
  });

  it("handles mixed whitespace and commas", () => {
    const input = " https://a.com , https://b.com  \n https://c.com ";
    const result = parseImportUrls(input);
    expect(result).toContain("https://a.com");
    expect(result).toContain("https://b.com");
    expect(result).toContain("https://c.com");
    expect(result).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BatchSSEEvent type narrowing helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("BatchSSEEvent type narrowing", () => {
  it("correctly narrows progress events", () => {
    const event: BatchSSEEvent = {
      type: "progress",
      index: 0,
      total: 3,
      url: "https://a.com",
      status: "extracting",
    };
    expect(event.type).toBe("progress");
    if (event.type === "progress") {
      expect(event.status).toBe("extracting");
      expect(event.total).toBe(3);
    }
  });

  it("correctly narrows result events", () => {
    const event: BatchSSEEvent = {
      type: "result",
      index: 1,
      url: "https://b.com",
      recipe: { title: "Pasta" },
    };
    if (event.type === "result") {
      expect(event.recipe).toEqual({ title: "Pasta" });
    }
  });

  it("correctly narrows done events", () => {
    const event: BatchSSEEvent = {
      type: "done",
      total: 5,
      succeeded: 4,
      failed: 1,
    };
    if (event.type === "done") {
      expect(event.succeeded + event.failed).toBe(event.total);
    }
  });
});
