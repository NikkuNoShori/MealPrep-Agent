# MOP-0008 Advisement: Eval Automation + Short-Form Video Intake

**Date:** 2026-06-14  
**Audience:** Nick Neal  
**Status:** Advisory (not implementation)  
**Blocks MOP-0008 `complete`:** Yes — per [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md)

---

## Executive summary

MOP-0008 is **structurally shipped** (agent loop, 12 tools, confirmation UI, unit tests). What blocks `complete` is:

1. **Nine `type: human` verification gates** (golden set, prompt injection, latency/cost)
2. **No short-form video path** (TikTok/Reels/Shorts) — only YouTube oEmbed title + client-supplied frames
3. **No description/comment link mining** for recipe URLs

This document is the roadmap to close both gaps without manual completion gates.

---

## Part A — Automate golden-set eval (unblock MOP-0008)

### Current state

- Fixture: `supabase/functions/chat-api/__tests__/fixtures/golden.json` (30 prompts, 3 buckets)
- `_meta` says "Not an automated runner — hand-evaluate"
- `agent-loop.test.ts` uses **scripted** tool calls — does not run the live LLM against golden prompts
- MOP-0008 human targets: ≥9/10 single-intent, ≥7/10 multi-intent, 10/10 destructive confirm

### Recommended architecture: two-tier eval

| Tier | What it tests | How | Gates `complete`? |
|------|---------------|-----|-------------------|
| **Tier 1 — Deterministic** | Tool routing with **mocked LLM** returning fixture tool_calls per prompt id | Extend `agent-loop.test.ts` or new `golden-routing.test.ts` | **Yes** |
| **Tier 2 — Live model** | Real OpenRouter responses, scoring quality/latency/cost | Scheduled CI job or manual `RUN_LIVE_EVAL=1` script | **No** (Manual Follow-up) |

**Policy alignment:** Tier 1 replaces human golden gates with `test-passes` / `command` assertions. Tier 2 moves to `## Manual Follow-up (non-blocking)` in MOP-0008.

### Tier 1 implementation plan (~4–6 hours)

1. **Add `golden-routing.test.ts`** (Deno, alongside agent-loop):
   - Load `golden.json`
   - For each prompt, inject a mock `chatWithTools` that returns the `expected_tool_sequence` as sequential tool_calls
   - Assert `runAgentLoop` invokes tools in order (multi-intent) or surfaces `pendingConfirmation` when `expected_destructive: true` **before** handler runs
   - For destructive bucket: assert handler mock was **not** called until confirm path

2. **Relax strict sequence where notes allow alternates** (e.g. ss-06: `search_recipes` OR `get_household_recipes`) — encode as `expected_tool_sequences: [["a"], ["b"]]` in fixture v2

3. **Prompt-injection bucket** — add 3 fixture prompts with malicious `<tool_result>` snippets; assert output stays wrapped and no unauthorized tools fire (already partially covered by agent-loop injection test — extend to golden ids)

4. **Update MOP-0008 verification YAML:**
   ```yaml
   - id: golden-routing-tests
     type: command
     run: deno test supabase/functions/chat-api/__tests__/golden-routing.test.ts
     expect_exit: 0
   ```
   Remove or relocate all `type: human` golden entries.

5. **Optional Tier 2 script** `scripts/run-golden-live-eval.ts`:
   - Requires `OPENROUTER_API_KEY`
   - Posts each prompt to deployed/local chat-api
   - Scores tool sequences vs expected; writes JSON report
   - Document in Manual Follow-up for quarterly regression

### Capability checks before live eval

| Check | Command / action |
|-------|------------------|
| chat-api deployed | Health + `intentMetadata.source === "tool_agent"` |
| OPENROUTER_API_KEY set | Supabase secrets / local env |
| WEB_SEARCH_API_KEY (optional) | Catalog gates `web_search_recipe` |
| Deno available | `deno test supabase/functions/chat-api/__tests__/` |

---

## Part B — Short-form video intake (TikTok / Reels / Shorts)

### Current state (`video-adapter.ts`)

| Platform | Supported today | Gap |
|----------|-----------------|-----|
| YouTube | oEmbed **title only** (description fetch is stubbed — oEmbed doesn't return description) | No transcript API |
| Uploaded video | Client extracts frames → `frame_urls` → vision OCR (max 4 frames) | No UI in product (`RecipeIntake` not built) |
| TikTok / Instagram / Facebook Reels | **Not recognized** | Treated as generic URL → likely fails |

Frame OCR uses `qwen/qwen-2.5-vl-7b-instruct` via OpenRouter — adequate for on-screen ingredient text.

### Recommended phased approach

#### Phase B1 — Link mining (high value, lower risk) — **do first**

**Goal:** When video metadata text exists, extract recipe URLs and optionally delegate to URL adapter.

**Where text comes from by platform:**

| Platform | Metadata source | API / method |
|----------|-----------------|--------------|
| YouTube | Description + pinned comment | YouTube Data API v3 (`videos.list` snippet) — needs API key OR `yt-dlp --dump-json` in edge function (heavy) |
| TikTok | Description, sometimes link in bio ref | oEmbed (`tiktok.com/oembed`) gives title/author — **no description**. Unofficial: scrape og:description (fragile) or TikTok Research API (restricted) |
| Instagram Reels | Caption | Meta Graph API (app review) or user-paste caption fallback |

**Pragmatic v1 (no platform API keys):**

1. Add `link-extractor.ts` in `_shared/`:
   - Regex URL harvest from any text blob
   - Filter to known recipe domains (allrecipes, NYT Cooking, blogs, etc.)
   - Score: prefer URLs with `/recipe`, JSON-LD likely paths

2. Extend `videoAdapter` pipeline order:
   ```
   metadata text (title, description, user-pasted caption)
     → link-extractor → if recipe URL found → optional url-adapter merge
     → frame OCR (existing)
     → LLM merge in extract stage
   ```

3. **Chat agent tool / pipeline input:** accept optional `caption_text` and `comments_text` fields (user pastes from TikTok/IG when auto-fetch fails).

4. **UI (separate MOP or MOP-0008 Phase 2):** Video import modal with:
   - URL field
   - Optional "paste description/caption" textarea
   - Optional "paste comments" textarea (user copies from app)

**Verification (automatable):**
   ```yaml
   - id: link-extractor-unit
     type: command
     run: deno test supabase/functions/_shared/__tests__/link-extractor.test.ts
   ```

#### Phase B2 — Frame sampling for short-form video

**Goal:** More than 4 frames, evenly spaced, without downloading full video in edge function.

**Client-side (preferred):**

- `src/utils/videoFrameExtractor.ts` — `<video>` element, seek to N timestamps, canvas → base64
- Upload frames to Supabase Storage → pass `frame_urls` to pipeline (existing contract)
- Recommend 8–12 frames for 60s TikTok; dedupe visually similar frames later

**Server-side (fallback):**

- Edge function cannot run ffmpeg reliably on Deno Deploy — **avoid** unless Cloud Run worker (out of scope for v1)

**TikTok-specific blocker:** Direct video download violates ToS without official API. **Do not scrape TikTok CDN URLs** without legal review. Safe path:

1. User uploads screen recording or saved video file → client frame extract
2. User pastes link + caption → link mining + manual caption
3. Future: TikTok Login Kit / Content Posting API if product justifies app review

#### Phase B3 — Platform metadata adapters

Create `adapters/platform-metadata/`:

| Adapter | Input | Output |
|---------|-------|--------|
| `youtube-metadata.ts` | video URL | title, description, top comments (API key) |
| `tiktok-oembed.ts` | video URL | title, author (description empty) |
| `generic-og.ts` | any URL | og:title, og:description |

Wire in `video-adapter.ts` before OCR.

### Suggested new MOP

**[MOP-0016: Short-Form Video Recipe Intake](MOP-0016-short-form-video-intake.md)** — `in_progress` as of 2026-06-15. Backend + chat wiring shipped; operator API keys + deploy smoke outstanding.

---

## Part C — MOP-0008 completion checklist (revised)

### Can mark `complete` after:

- [ ] Tier 1 golden-routing Deno tests pass (replaces human golden gates)
- [ ] Existing lint/build/vitest/agent-loop tests pass
- [ ] Human eval items moved to `## Manual Follow-up (non-blocking)`
- [ ] `/verify-mop MOP-0008` passes with zero `type: human` in verification YAML

### Stays out of MOP-0008 (separate track):

- TikTok/Reels frame OCR product UI → MOP-0016
- Live model quality eval → Manual Follow-up / quarterly script
- Production latency/cost SLOs → RUNBOOK metrics, not MOP gate

---

## Part D — Tooling inventory

| Tool | Purpose | Required for |
|------|---------|--------------|
| Deno | Edge function tests | Golden routing, link-extractor |
| Vitest + MSW | Frontend/API unit tests | Regression |
| OpenRouter | Live eval only | Tier 2 (optional) |
| YouTube Data API v3 | Description + comments | Phase B1 YouTube (optional key) |
| Playwright | E2E smoke | Auth redirect smoke (existing) |
| Tavily/Brave | web_search_recipe | Already in chat-api |

---

## Recommended execution order

1. **This week:** Tier 1 golden-routing test → update MOP-0008 verification → `/verify-mop MOP-0008`
2. **Next:** `link-extractor` + caption/comment fields on video adapter (no UI — API-only + chat tool)
3. **Then:** Client frame extractor + import modal ([MOP-0016](MOP-0016-short-form-video-intake.md) — Phase 5 deferred)
4. **Later:** YouTube Data API for description; TikTok only via user paste until official API path

---

## Questions for you (decisions)

1. **YouTube Data API key** — OK to add as Supabase secret for description/comment fetch?
2. **TikTok strategy** — user-paste caption + client upload only (safe), or invest in scraping risk?
3. **Tier 2 live eval** — run locally before releases, or skip until CI budget exists?
