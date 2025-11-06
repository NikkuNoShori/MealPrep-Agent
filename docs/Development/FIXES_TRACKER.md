# Fixes & Issues Tracker

## Table of Fixes

| Date | Issue | Status | Solution | Files Changed | Related Docs |
|------|-------|--------|----------|---------------|--------------|
| 2025-11-06 | RAG Search endpoint not accessible from n8n | ✅ Fixed | Deployed as Vercel Edge Function | `api/rag/search.js`, `.npmrc`, `package.json` | [RAG_SEARCH_EDGE_FUNCTION_FIX.md](./RAG_SEARCH_EDGE_FUNCTION_FIX.md) |

## Issue Categories

### Network & Connectivity
- **RAG Search endpoint accessibility** - Fixed by deploying to Vercel Edge Functions

### Database & Schema
- Stored procedures not found - Fixed by using direct SQL queries
- `recipe_embeddings` table missing - Fixed with fallback queries
- UUID type mismatches - Fixed with proper type casting

### API Configuration
- OpenRouter API key detection - Fixed with auto-detection logic
- Environment variable naming - Fixed with flexible key detection

## How to Add New Fixes

1. Document the fix in `docs/Development/FIXES_TRACKER.md`
2. Create detailed documentation in `docs/Development/[FEATURE]_FIX.md`
3. Update this table with:
   - Date
   - Issue description
   - Status (✅ Fixed, 🔄 In Progress, ❌ Blocked)
   - Solution summary
   - Files changed
   - Link to detailed documentation

## Status Legend

- ✅ Fixed - Issue resolved and deployed
- 🔄 In Progress - Currently being worked on
- ❌ Blocked - Waiting on external dependency
- ⚠️ Known Issue - Documented but not yet fixed

