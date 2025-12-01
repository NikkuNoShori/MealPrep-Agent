// Supabase Edge Function for Chat API
// Updated with intelligent intent routing and direct OpenRouter integration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS (Version-controlled in Git!)
// ═══════════════════════════════════════════════════════════════════

const INTENT_DETECTION_PROMPT = `# Intent Classification System

You are an intent classifier for a meal planning application.

## Intent Types

1. **recipe_extraction** - User wants to ADD/SAVE a new recipe
   - Has recipe text to parse
   - Uploaded recipe images/screenshots
   - Says "add recipe", "save this recipe", "extract recipe"

2. **rag_search** - User wants to FIND/SEARCH existing recipes
   - "Find recipes with [ingredient]"
   - "What recipes do I have?"
   - "Show me [type] recipes"

3. **general_chat** - Everything else
   - Greetings, general cooking questions
   - Not about specific recipes

Return ONLY valid JSON: {"intent":"...", "reason":"...", "confidence":0.95}`

const RECIPE_EXTRACTION_PROMPT = `# Recipe Extraction Engine

Extract structured recipe data from text and images.

Return ONLY valid JSON:
{
  "recipe": {
    "title": "Recipe Name",
    "description": "Brief description",
    "ingredients": [
      {"name": "ingredient", "amount": 2.5, "unit": "cups", "category": "pantry"}
    ],
    "instructions": ["Step 1: ...", "Step 2: ..."],
    "prepTime": 15,
    "cookTime": 30,
    "servings": 4,
    "difficulty": "easy",
    "tags": ["vegetarian", "quick"]
  }
}

Rules:
- Never hallucinate
- Convert measurements to numbers (2.5 not "2 1/2")
- Use standard units (cups, tbsp, tsp, oz, lb, g, kg)
- No commentary, only JSON`

const GENERAL_CHAT_PROMPT = `# Cooking & Meal Planning Assistant

You are a helpful cooking assistant.

Capabilities:
- Answer general cooking questions
- Provide cooking tips and techniques
- Suggest meal ideas
- Discuss ingredients and substitutions

Limitations:
- You CANNOT search user's recipe collection (tell them to use search)
- You CANNOT add recipes (tell them to use "Add Recipe" button)

Response Style:
- Conversational and friendly
- Concise (2-3 paragraphs max)
- Practical and actionable
- Stay on topic (cooking, food, meal planning)`

// ═══════════════════════════════════════════════════════════════════
// OPENROUTER CLIENT
// ═══════════════════════════════════════════════════════════════════

class OpenRouterClient {
  private defaultApiKey: string;
  private vlApiKey?: string; // For vision language models
  private instructApiKey?: string; // For instruction models
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(
    defaultApiKey: string,
    vlApiKey?: string,
    instructApiKey?: string
  ) {
    this.defaultApiKey = defaultApiKey;
    this.vlApiKey = vlApiKey;
    this.instructApiKey = instructApiKey;
  }

  // Get the appropriate API key based on model type
  private getApiKeyForModel(model: string): string {
    const apiKey = (() => {
      // Vision Language models (VL)
      if (model.includes("vl") || model.includes("vision")) {
        return this.vlApiKey || this.defaultApiKey;
      }
      // Instruction models
      if (model.includes("instruct") || model.includes("qwen")) {
        return this.instructApiKey || this.defaultApiKey;
      }
      // Default fallback
      return this.defaultApiKey;
    })();

    // Validate the API key is not empty
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("OpenRouter API key is empty or invalid. Please configure OPENROUTER_API_KEY in Supabase Edge Function secrets.");
    }

    return apiKey;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    model: string = "qwen/qwen-2.5-7b-instruct",
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    }
  ): Promise<string> {
    const apiKey = this.getApiKeyForModel(model);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 500,
        response_format: options?.response_format,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenRouter API failed: ${response.status}`;
      
      // Provide specific error messages for common issues
      if (response.status === 401) {
        errorMessage = "OpenRouter API key is invalid or missing. Please check your OPENROUTER_API_KEY configuration in Supabase Edge Function secrets.";
        console.error("❌ OpenRouter authentication failed:", {
          status: response.status,
          error: errorText,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + "...",
        });
      } else {
        console.error("OpenRouter error:", response.status, errorText);
        errorMessage = `OpenRouter API failed: ${response.status} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async chatWithHistory(
    systemPrompt: string,
    conversationHistory: any[],
    userMessage: string,
    model: string = "qwen/qwen-2.5-7b-instruct",
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<string> {
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const apiKey = this.getApiKeyForModel(model);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenRouter API failed: ${response.status}`;
      
      // Provide specific error messages for common issues
      if (response.status === 401) {
        errorMessage = "OpenRouter API key is invalid or missing. Please check your OPENROUTER_API_KEY configuration in Supabase Edge Function secrets.";
        console.error("❌ OpenRouter authentication failed:", {
          status: response.status,
          error: errorText,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + "...",
        });
      } else {
        console.error("OpenRouter chatWithHistory error:", response.status, errorText);
        errorMessage = `OpenRouter API failed: ${response.status} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid OpenRouter response:", data);
      throw new Error("Invalid response from OpenRouter API");
    }
    return data.choices[0].message.content;
  }

  async chatWithImages(
    systemPrompt: string,
    userMessage: string,
    images: string[],
    model: string = "qwen/qwen-2.5-vl-7b-instruct",
    options?: {
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    }
  ): Promise<string> {
    const userContent = [
      { type: "text", text: userMessage },
      ...images.slice(0, 4).map((img) => ({
        type: "image_url",
        image_url: { url: img },
      })),
    ];

    const apiKey = this.getApiKeyForModel(model);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": Deno.env.get("FRONTEND_URL") || "",
        "X-Title": "MealPrep Agent",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.max_tokens ?? 2000,
        response_format: options?.response_format,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenRouter API failed: ${response.status}`;
      
      // Provide specific error messages for common issues
      if (response.status === 401) {
        errorMessage = "OpenRouter API key is invalid or missing. Please check your OPENROUTER_API_KEY configuration in Supabase Edge Function secrets.";
        console.error("❌ OpenRouter authentication failed (chatWithImages):", {
          status: response.status,
          error: errorText,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + "...",
        });
      } else {
        console.error("OpenRouter chatWithImages error:", response.status, errorText);
        errorMessage = `OpenRouter API failed: ${response.status} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// ═══════════════════════════════════════════════════════════════════
// INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════

async function detectIntent(
  message: string,
  images: string[],
  openRouter: OpenRouterClient
): Promise<{ intent: string; reason: string; confidence: number }> {
  try {
    const userMessage =
      images.length > 0
        ? `${message || "Classify this content"}\n\n[${
            images.length
          } image(s) provided]`
        : message;

    const response = await openRouter.chat(
      INTENT_DETECTION_PROMPT,
      userMessage,
      "qwen/qwen-2.5-7b-instruct",
      {
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }
    );

    const result = JSON.parse(response);

    // Validate intent
    const validIntents = ["recipe_extraction", "rag_search", "general_chat"];
    if (!validIntents.includes(result.intent)) {
      console.warn("Invalid intent:", result.intent);
      return {
        intent: "general_chat",
        reason: "Invalid intent",
        confidence: 0.5,
      };
    }

    console.log("✅ Intent detected:", result);
    return result;
  } catch (error) {
    console.error("❌ Intent detection error:", error);
    return {
      intent: "general_chat",
      reason: `Error: ${error.message}`,
      confidence: 0.5,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// RECIPE EXTRACTION
// Direct extraction using OpenRouter vision/text models
// ═══════════════════════════════════════════════════════════════════

async function extractRecipe(
  message: string,
  images: string[],
  openRouter: OpenRouterClient
): Promise<{ success: boolean; recipe?: any; error?: string }> {
  try {
    const imageCount = images.length;
    const userPrompt =
      imageCount > 0
        ? `${
            message || "Extract the recipe from the provided images."
          }\n\n[${imageCount} image(s) provided]\n\nExtract the recipe and return structured JSON.`
        : `${message}\n\nExtract the recipe and return structured JSON.`;

    let response: string;

    if (imageCount > 0) {
      // Use vision model for images
      response = await openRouter.chatWithImages(
        RECIPE_EXTRACTION_PROMPT,
        userPrompt,
        images,
        "qwen/qwen-2.5-vl-7b-instruct",
        {
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }
      );
    } else {
      // Use text model for text-only
      response = await openRouter.chat(
        RECIPE_EXTRACTION_PROMPT,
        userPrompt,
        "qwen/qwen-2.5-7b-instruct",
        {
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }
      );
    }

    // Parse JSON
    const parsed = JSON.parse(response);
    const recipe = parsed.recipe || parsed;

    // Validate
    if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
      throw new Error("Invalid recipe structure: missing required fields");
    }

    console.log("✅ Recipe extracted:", recipe.title);
    return { success: true, recipe };
  } catch (error) {
    console.error("❌ Recipe extraction error:", error);
    return {
      success: false,
      error: error.message || "Recipe extraction failed",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GENERAL CHAT
// Direct chat using OpenRouter models
// ═══════════════════════════════════════════════════════════════════

async function handleGeneralChat(
  message: string,
  conversationId: string,
  supabase: any,
  openRouter: OpenRouterClient
): Promise<string> {
  try {
    // Get recent conversation history
    const { data: recentMessages, error: historyError } = await supabase
      .from("chat_messages")
      .select("content, sender, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyError) {
      console.error("❌ Error fetching conversation history:", historyError);
      // Continue without history rather than failing
    }

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));

    // Use the same model as intent detection for consistency
    // qwen-2.5-7b-instruct is more reliable than qwen3-8b
    const model = "qwen/qwen-2.5-7b-instruct";
    console.log(`💬 Generating general chat response with model: ${model}, history length: ${conversationHistory.length}`);

    // Try chatWithHistory first (with context)
    try {
      const response = await openRouter.chatWithHistory(
        GENERAL_CHAT_PROMPT,
        conversationHistory,
        message,
        model,
        { temperature: 0.7, max_tokens: 500 }
      );

      console.log("✅ General chat response generated");
      return response;
    } catch (historyError: any) {
      console.warn("⚠️ chatWithHistory failed, trying simple chat:", historyError?.message);
      
      // Fallback: Use simple chat without history if chatWithHistory fails
      // This handles cases where the model doesn't support history or there's an API issue
      const fallbackResponse = await openRouter.chat(
        GENERAL_CHAT_PROMPT,
        message,
        model,
        { temperature: 0.7, max_tokens: 500 }
      );

      console.log("✅ General chat response generated (fallback mode)");
      return fallbackResponse;
    }
  } catch (error: any) {
    console.error("❌ General chat error:", error);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    
    // Try to extract more details from the error
    let errorDetails = error?.message || String(error);
    if (error?.response) {
      try {
        const errorText = await error.response.text();
        errorDetails += ` - Response: ${errorText}`;
      } catch (e) {
        // Ignore
      }
    }
    console.error("Full error details:", errorDetails);
    
    // Provide more specific error message if possible
    if (error?.message?.includes("model") || error?.message?.includes("404") || error?.message?.includes("not found")) {
      return "I'm having trouble with the AI model right now. Please try again in a moment.";
    }
    if (error?.message?.includes("API") || error?.message?.includes("401") || error?.message?.includes("403")) {
      return "I'm having trouble connecting to the AI service. Please check your API configuration.";
    }
    if (error?.message?.includes("timeout") || error?.message?.includes("network")) {
      return "The AI service is taking too long to respond. Please try again in a moment.";
    }
    
    return "I apologize, but I'm having trouble processing your message right now. Please try again.";
  }
}

// ═══════════════════════════════════════════════════════════════════
// RAG SEARCH
// Searches user's recipe collection using semantic search
// ═══════════════════════════════════════════════════════════════════

async function callRAGWorkflow(
  message: string,
  sessionId: string,
  conversationId: string,
  userId: string
): Promise<string> {
  const n8nUrl = Deno.env.get("N8N_RAG_WEBHOOK_URL");

  if (!n8nUrl) {
    console.error(
      "❌ N8N_RAG_WEBHOOK_URL not configured in environment variables"
    );
    return "Recipe search is temporarily unavailable. The n8n webhook URL is not configured. Please contact support.";
  }

  // Warn if URL is localhost (won't work from cloud, but OK for local testing)
  if (n8nUrl.includes("localhost") || n8nUrl.includes("127.0.0.1")) {
    console.warn(
      "⚠️ N8N_RAG_WEBHOOK_URL is using localhost - this will ONLY work when running Supabase Edge Functions locally"
    );
    console.warn(
      "   For production/deployed functions, use a public URL like https://agents.eaglesightlabs.com"
    );
    // Allow it to proceed - will work when running locally with `supabase functions serve`
  }

  // Log which type of URL is being used
  if (n8nUrl.includes("/workflow/")) {
    console.log("ℹ️ Using n8n workflow endpoint (may require auth)");
  } else if (n8nUrl.includes("/webhook/")) {
    console.log("ℹ️ Using n8n webhook endpoint");
  }

  try {
    console.log(`🔍 Calling n8n webhook: ${n8nUrl}`);
    const startTime = Date.now();

    const response = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId,
        conversationId,
        userId,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ n8n response received in ${duration}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ n8n webhook failed: ${response.status} ${response.statusText}`
      );
      console.error(`   Response: ${errorText}`);
      throw new Error(`n8n webhook failed: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      const result =
        data.content || data.message || data.output || data.response || text;
      console.log("✅ n8n workflow completed successfully");
      return result;
    } catch (parseError) {
      console.warn("⚠️ n8n returned non-JSON response, using as-is");
      return text;
    }
  } catch (error) {
    console.error("❌ RAG workflow error:", error);
    console.error("   Error type:", error.name);
    console.error("   Error message:", error.message);

    // Provide more specific error messages
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return "Recipe search timed out. The n8n workflow took too long to respond. Please try again.";
    }
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("ECONNREFUSED")
    ) {
      return "Recipe search is unavailable. Cannot connect to n8n instance. Please check that n8n is running and accessible.";
    }
    if (error.message.includes("404")) {
      return "Recipe search webhook not found. The n8n workflow URL may be incorrect or the workflow was deleted.";
    }

    return "I had trouble searching your recipes. Please try rephrasing your question or try again later.";
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════════════════════════

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Support model-specific API keys
    const openRouterKeyDefault = Deno.env.get("OPENROUTER_API_KEY");
    const openRouterKeyVL = Deno.env.get("OPENROUTER_API_KEY_QWEN2.5_VL_8b");
    const openRouterKeyInstruct = Deno.env.get(
      "OPENROUTER_API_KEY_QWEN2.5_instruct_8b"
    );

    // Use default key or fallback to one of the model-specific keys
    const defaultKey =
      openRouterKeyDefault || openRouterKeyInstruct || openRouterKeyVL;

    // Validate OpenRouter API key (check for presence and non-empty)
    if (!defaultKey || defaultKey.trim() === "") {
      console.error("❌ OPENROUTER_API_KEY not configured");
      console.error("   Available env vars:", {
        hasDefault: !!openRouterKeyDefault,
        hasVL: !!openRouterKeyVL,
        hasInstruct: !!openRouterKeyInstruct,
      });
      return new Response(
        JSON.stringify({
          error: "OpenRouter API key not configured. Please set OPENROUTER_API_KEY in Supabase Edge Function secrets.",
          details: "To fix: Run 'supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here'",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Log key status (without exposing the actual key)
    console.log("✅ OpenRouter API key configured", {
      hasDefault: !!openRouterKeyDefault,
      hasVL: !!openRouterKeyVL,
      hasInstruct: !!openRouterKeyInstruct,
      defaultKeyLength: defaultKey.length,
    });

    // Create OpenRouter client with model-specific keys
    const openRouter = new OpenRouterClient(
      defaultKey,
      openRouterKeyVL, // For vision language models
      openRouterKeyInstruct // For instruction models
    );

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Health check endpoint (no auth required)
    if (method === "GET" && path.includes("/health")) {
      return new Response(
        JSON.stringify({
          status: "OK",
          timestamp: new Date().toISOString(),
          openRouterConfigured: !!defaultKey,
          openRouterKeysConfigured: {
            default: !!openRouterKeyDefault,
            vl: !!openRouterKeyVL,
            instruct: !!openRouterKeyInstruct,
          },
          n8nConfigured: !!Deno.env.get("N8N_RAG_WEBHOOK_URL"),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get authenticated user from Supabase Auth (required for all other endpoints)
    const authHeader = req.headers.get("Authorization");
    let user = null;
    let userToken = null;

    if (authHeader) {
      userToken = authHeader.replace("Bearer ", "");
      const tempSupabase = createClient(supabaseUrl, supabaseKey);
      const {
        data: { user: authUser },
        error: authError,
      } = await tempSupabase.auth.getUser(userToken);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    // Require authentication for all other endpoints
    if (!user || !userToken) {
      return new Response(
        JSON.stringify({ error: "Authentication required. Please sign in." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Create authenticated Supabase client with user's JWT token for RLS
    const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
    });

    // Route handling (all require auth)
    if (method === "POST" && path.includes("/message")) {
      return await handleSendMessage(req, supabaseAuth, user, openRouter);
    } else if (method === "GET" && path.includes("/history")) {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      return await handleGetHistory(req, supabaseAuth, user, limit);
    } else if (method === "DELETE" && path.includes("/history")) {
      return await handleClearHistory(req, supabaseAuth, user);
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 404,
    });
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// HANDLE SEND MESSAGE (Updated with intelligent routing)
// ═══════════════════════════════════════════════════════════════════

async function handleSendMessage(
  req: Request,
  supabase: any,
  user: any,
  openRouter: OpenRouterClient
) {
  try {
    const {
      message,
      context,
      sessionId,
      intent: manualIntent,
      images = [],
    } = await req.json();

    // Validate input
    if (!message && images.length === 0) {
      return new Response(
        JSON.stringify({ error: "Message or images required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get or create conversation
    let conversationId: string;
    const session_id =
      sessionId || context?.sessionId || `session-${Date.now()}`;

    const { data: existingConv, error: findError } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingConv && !findError) {
      conversationId = existingConv.id;
      if (manualIntent) {
        await supabase
          .from("chat_conversations")
          .update({ selected_intent: manualIntent })
          .eq("id", conversationId);
      }
    } else {
      const title =
        message?.length > 50
          ? message.substring(0, 50) + "..."
          : message || "New conversation";
      const { data: newConv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: user.id,
          title,
          session_id,
          selected_intent: manualIntent || null,
          metadata: context?.metadata || {},
        })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      content: message || "[Images only]",
      sender: "user",
      message_type: "text",
      metadata: { images: images.length, hasImages: images.length > 0 },
    });

    // ═══════════════════════════════════════════════════════════════
    // INTELLIGENT INTENT ROUTING
    // ═══════════════════════════════════════════════════════════════

    const startTime = Date.now();
    let routingIntent: string;
    let intentMetadata: any = {};

    if (manualIntent) {
      // User explicitly selected intent via button
      routingIntent = manualIntent;
      intentMetadata = { source: "manual", intent: manualIntent };
      console.log("📍 Using manual intent:", manualIntent);
    } else {
      // AI-powered intent detection
      console.log("🤖 Detecting intent with AI...");
      const intentResult = await detectIntent(
        message || "",
        images,
        openRouter
      );
      routingIntent = intentResult.intent;
      intentMetadata = {
        source: "ai",
        detectedIntent: intentResult.intent,
        reason: intentResult.reason,
        confidence: intentResult.confidence,
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // ROUTE TO APPROPRIATE SERVICE
    // ═══════════════════════════════════════════════════════════════

    let aiResponse: string;
    let recipe: any = null;

    if (routingIntent === "recipe_extraction") {
      console.log("📝 Routing to Recipe Extraction (direct)...");
      const extractionResult = await extractRecipe(
        message || "",
        images,
        openRouter
      );
      if (extractionResult.success) {
        recipe = extractionResult.recipe;
        aiResponse = "I've extracted the recipe! Here's what I found:";
      } else {
        aiResponse = `I had trouble extracting the recipe: ${extractionResult.error}`;
      }
    } else if (routingIntent === "rag_search") {
      console.log("🔍 Routing to RAG Search...");
      aiResponse = await callRAGWorkflow(
        message || "",
        session_id,
        conversationId,
        user.id
      );
    } else {
      console.log("💬 Routing to General Chat (direct)...");
      aiResponse = await handleGeneralChat(
        message || "",
        conversationId,
        supabase,
        openRouter
      );
    }

    const routingDuration = Date.now() - startTime;
    console.log(`✅ Routing completed in ${routingDuration}ms`);

    // Save AI response
    const { data: aiMessage } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        content: aiResponse,
        sender: "ai",
        message_type: recipe ? "recipe" : "text",
        metadata: { ...intentMetadata, recipe, routingDuration },
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({
        message: "Message processed successfully",
        response: {
          id: aiMessage.id,
          content: aiResponse,
          sender: "ai",
          timestamp: new Date().toISOString(),
        },
        recipe,
        conversationId,
        sessionId: session_id,
        intentMetadata,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ handleSendMessage error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLE GET HISTORY (Unchanged)
// ═══════════════════════════════════════════════════════════════════

async function handleGetHistory(
  req: Request,
  supabase: any,
  user: any,
  limit: number
) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        type: msg.message_type,
        timestamp: msg.created_at,
        metadata: msg.metadata,
      }));

      return new Response(JSON.stringify({ messages: formattedMessages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: conversations, error } = await supabase
      .from("chat_conversations")
      .select(
        `
        id,
        title,
        session_id,
        selected_intent,
        created_at,
        updated_at,
        last_message_at
      `
      )
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const conversationIds = conversations.map((c: any) => c.id);
    const { data: messageCounts } = await supabase
      .from("chat_messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds);

    const countsMap = new Map<string, number>();
    messageCounts?.forEach((msg: any) => {
      countsMap.set(
        msg.conversation_id,
        (countsMap.get(msg.conversation_id) || 0) + 1
      );
    });

    const formattedConversations = conversations.map((conv: any) => ({
      id: conv.id,
      title: conv.title,
      sessionId: conv.session_id,
      selectedIntent: conv.selected_intent,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      lastMessageAt: conv.last_message_at,
      messageCount: countsMap.get(conv.id) || 0,
    }));

    return new Response(
      JSON.stringify({ conversations: formattedConversations }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLE CLEAR HISTORY (Unchanged)
// ═══════════════════════════════════════════════════════════════════

async function handleClearHistory(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Conversation deleted successfully" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Chat history cleared successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}
