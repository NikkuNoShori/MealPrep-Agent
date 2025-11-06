# n8n Workflow: Production Fixes Guide

## Step-by-Step Instructions

This guide provides exact instructions for fixing the production issues in `MealPrep Agent (1).json`.

---

## Fix 1: Update Save Recipe URL (CRITICAL)

### Location
- **File**: `MealPrep Agent (1).json`
- **Node**: "Save Recipe" node
- **Line**: ~190 (in the `parameters` object)

### Current Code
```json
"url": "http://localhost:3000/api/recipes",
```

### What to Change
Replace the hardcoded localhost URL with a production URL that can be overridden.

### New Code
```json
"url": "={{ $json.apiUrl || 'https://meal-prep-agent-delta.vercel.app/api/recipes' }}",
```

### Steps
1. Open `MealPrep Agent (1).json` in your editor
2. Find the "Save Recipe" node (search for `"name": "Save Recipe"`)
3. Locate the `"url"` field in the `parameters` object
4. Replace `"http://localhost:3000/api/recipes"` with `"={{ $json.apiUrl || 'https://meal-prep-agent-delta.vercel.app/api/recipes' }}"`
5. Save the file

### Why
- The localhost URL only works when n8n is on the same machine as your API server
- In production, n8n is likely on a different machine, so localhost will fail
- The new code allows the URL to be overridden via `$json.apiUrl` or defaults to production

---

## Fix 2: Remove Test User Fallback (CRITICAL)

### Location
- **File**: `MealPrep Agent (1).json`
- **Node**: "Save Recipe" node
- **Line**: ~253 (in the `bodyParameters` array)

### Current Code
```json
{
  "name": "userId",
  "value": "={{ $json.userId || 'test-user' }}"
}
```

### What to Change
Remove the test user fallback to prevent security issues.

### New Code
```json
{
  "name": "userId",
  "value": "={{ $json.userId }}"
}
```

### Steps
1. In the same "Save Recipe" node, find the `bodyParameters` array
2. Locate the parameter with `"name": "userId"`
3. Change the `"value"` from `"={{ $json.userId || 'test-user' }}"` to `"={{ $json.userId }}"`
4. Save the file

### Why
- The test user fallback is a security risk
- Recipes could be saved with the wrong user ID if userId is missing
- Better to fail explicitly than silently use a test user

### Alternative (If you want error handling)
If you want to handle missing userId gracefully, you could add a validation node before Save Recipe, but for production, it's better to ensure userId is always provided from the webhook.

---

## Fix 3: Fix RAG Chat Agent Data Format (MEDIUM)

### Issue
The RAG Chat Agent prompt expects `{{ $json.recipeContext }}`, but RAG Search returns `{ results: [...], total: number, ... }`. The `recipeContext` field doesn't exist.

### Option A: Add Transformation Node (Recommended)

#### Location
- **File**: `MealPrep Agent (1).json`
- **Position**: Between "RAG Search" and "RAG Chat Agent" nodes
- **New Node**: Add a "Set" or "Code" node

#### Steps
1. In n8n, add a new "Set" node between "RAG Search" and "RAG Chat Agent"
2. Name it: "Format RAG Results"
3. Configure it to set:
   - **Name**: `recipeContext`
   - **Value**: `={{ JSON.stringify($json.results || []) }}`
4. Connect:
   - "RAG Search" output → "Format RAG Results" input
   - "Format RAG Results" output → "RAG Chat Agent" input
5. Update the connection in the JSON:
   - Change "RAG Search" main output to point to "Format RAG Results"
   - Change "Format RAG Results" main output to point to "RAG Chat Agent"

#### JSON Structure (if editing directly)
Add this node after "RAG Search" node:
```json
{
  "parameters": {
    "values": {
      "string": [
        {
          "name": "recipeContext",
          "value": "={{ JSON.stringify($json.results || []) }}"
        }
      ]
    },
    "options": {}
  },
  "type": "n8n-nodes-base.set",
  "typeVersion": 1,
  "position": [1000, -20],
  "id": "format-rag-results-id",
  "name": "Format RAG Results"
}
```

Then update connections:
- "RAG Search" main output → "Format RAG Results"
- "Format RAG Results" main output → "RAG Chat Agent"

---

### Option B: Update RAG Chat Agent Prompt (Simpler)

#### Location
- **File**: `MealPrep Agent (1).json`
- **Node**: "RAG Chat Agent" node
- **Line**: ~74 (in the `text` field of `parameters`)

#### Current Code
```json
"text": "User Query: {{ $json.message }}\n\nContext from Recipe Database:\n{{ $json.recipeContext }}\n\nPlease provide a helpful response..."
```

#### What to Change
Update the prompt to use `$json.results` instead of `$json.recipeContext`.

#### New Code
```json
"text": "User Query: {{ $json.message }}\n\nContext from Recipe Database:\n{{ JSON.stringify($json.results || []) }}\n\nPlease provide a helpful response..."
```

#### Steps
1. Find the "RAG Chat Agent" node
2. Locate the `"text"` field in the `parameters` object
3. Find `{{ $json.recipeContext }}` in the text
4. Replace it with `{{ JSON.stringify($json.results || []) }}`
5. Save the file

#### Why
- RAG Search returns `results` array, not `recipeContext`
- This directly uses the actual field name from RAG Search output
- Simpler than adding a transformation node

---

## Summary of Changes

### Critical Fixes (Must Do)
1. ✅ **Fix 1**: Update Save Recipe URL (Line ~190)
   - Change: `"http://localhost:3000/api/recipes"` 
   - To: `"={{ $json.apiUrl || 'https://meal-prep-agent-delta.vercel.app/api/recipes' }}"`

2. ✅ **Fix 2**: Remove test user fallback (Line ~253)
   - Change: `"={{ $json.userId || 'test-user' }}"`
   - To: `"={{ $json.userId }}"`

### Recommended Fix (Should Do)
3. ⚠️ **Fix 3**: Fix RAG Chat Agent data format (Line ~74)
   - **Option A**: Add transformation node between RAG Search and RAG Chat Agent
   - **Option B**: Update prompt to use `{{ JSON.stringify($json.results || []) }}` instead of `{{ $json.recipeContext }}`

---

## Verification Checklist

After making changes, verify:

- [ ] Save Recipe URL no longer contains `localhost`
- [ ] Save Recipe userId no longer has `'test-user'` fallback
- [ ] RAG Chat Agent can access recipe context (either via transformation node or updated prompt)
- [ ] All connections are still valid
- [ ] Test the workflow with a recipe extraction request
- [ ] Test the workflow with a RAG chat request (recipe-related)
- [ ] Test the workflow with a general chat request

---

## Testing After Changes

1. **Test Recipe Extraction**:
   - Send a webhook request with `intent: "recipe_extraction"`
   - Verify recipe is saved to production API
   - Verify userId is correct (not test-user)

2. **Test RAG Chat (Recipe Query)**:
   - Send a webhook request with recipe-related query
   - Verify RAG Search executes
   - Verify RAG Chat Agent receives recipe context
   - Verify response includes recipe information

3. **Test General Chat**:
   - Send a webhook request with general query
   - Verify RAG Search is skipped
   - Verify RAG Chat Agent responds without recipe context

---

## Notes

- **Save Recipe URL**: If your production API is on a different domain, update the fallback URL accordingly
- **userId**: Ensure your webhook always provides `userId` in the payload. If it doesn't, you may need to update the webhook payload structure
- **RAG Context**: Option B (updating the prompt) is simpler but Option A (transformation node) gives you more control over data formatting

---

**Ready to make changes?** Follow the steps above in order, starting with the critical fixes.


