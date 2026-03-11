// Supabase Edge Function for Chat API
// Uses shared modules for OpenRouter, prompts, and CORS.
// Delegates recipe extraction to the recipe-pipeline edge function.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, corsError } from "../_shared/cors.ts";
import { getUserFromToken } from "../_shared/supabase-client.ts";
import {
  OpenRouterClient,
  createOpenRouterClient,
} from "../_shared/openrouter-client.ts";
import {
  INTENT_DETECTION_PROMPT,
  GENERAL_CHAT_PROMPT,
} from "../_shared/recipe-prompts.ts";

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
        ? `${message || "Classify this content"}\n\n[${images.length} image(s) provided]`
        : message;

    const response = await openRouter.chat(
      INTENT_DETECTION_PROMPT,
      userMessage,
      "qwen/qwen-2.5-7b-instruct",
      { temperature: 0.1, max_tokens: 150, response_format: { type: "json_object" } }
    );

    const result = JSON.parse(response);

    const validIntents = ["recipe_extraction", "rag_search", "general_chat"];
    if (!validIntents.includes(result.intent)) {
      console.warn("Invalid intent:", result.intent);
      return { intent: "general_chat", reason: "Invalid intent", confidence: 0.5 };
    }

    console.log("Intent detected:", result);
    return result;
  } catch (error) {
    console.error("Intent detection error:", error);
    return { intent: "general_chat", reason: `Error: ${error.message}`, confidence: 0.5 };
  }
}

// ═══════════════════════════════════════════════════════════════════
// RECIPE EXTRACTION — delegates to recipe-pipeline/extract-only
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect a URL in the message text.
 */
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/i);
  return match ? match[0] : null;
}

async function extractRecipe(
  message: string,
  images: string[],
  userToken: string
): Promise<{ success: boolean; recipe?: any; error?: string; source_url?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const pipelineUrl = `${supabaseUrl}/functions/v1/recipe-pipeline/extract-only`;

    // Detect URL in message — route to url adapter
    const detectedUrl = extractUrl(message || "");
    let pipelineBody: Record<string, unknown>;

    if (detectedUrl) {
      console.log("URL detected, using url adapter:", detectedUrl);
      pipelineBody = {
        source_type: "url",
        url: detectedUrl,
        auto_save: false,
      };
    } else {
      pipelineBody = {
        source_type: "text",
        text: message || "",
        images: images,
        auto_save: false,
      };
    }

    const response = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify(pipelineBody),
      signal: AbortSignal.timeout(50000),
    });

    const result = await response.json();

    if (result.success && result.recipe) {
      console.log("Recipe extracted via pipeline:", result.recipe.title);
      return { success: true, recipe: result.recipe, source_url: detectedUrl || undefined };
    }

    const errorMsg = result.errors?.[0]?.message || "Recipe extraction failed";
    return { success: false, error: errorMsg };
  } catch (error) {
    console.error("Recipe extraction error:", error);
    return { success: false, error: error.message || "Recipe extraction failed" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// GENERAL CHAT (Direct)
// ═══════════════════════════════════════════════════════════════════

async function handleGeneralChat(
  message: string,
  conversationId: string,
  supabase: any,
  openRouter: OpenRouterClient
): Promise<string> {
  try {
    const { data: recentMessages, error: historyError } = await supabase
      .from("chat_messages")
      .select("content, sender, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyError) {
      console.error("Error fetching conversation history:", historyError);
    }

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));

    const model = "qwen/qwen-2.5-7b-instruct";

    const response = await openRouter.chatWithHistory(
      GENERAL_CHAT_PROMPT,
      conversationHistory,
      message,
      model,
      { temperature: 0.7, max_tokens: 500 }
    );

    return response;
  } catch (error) {
    console.error("General chat error:", error);
    return "I apologize, but I'm having trouble processing your message right now. Please try again.";
  }
}

// ═══════════════════════════════════════════════════════════════════
// RAG SEARCH
// Hybrid semantic + text search against user's recipe collection
// ═══════════════════════════════════════════════════════════════════

const RAG_RESPONSE_PROMPT = `You are a helpful cooking assistant answering questions about the user's recipe collection.

You have been given search results from the user's saved recipes. Use ONLY these results to answer.

Rules:
- Reference specific recipe names when relevant
- If no results match, say so honestly — don't make up recipes
- Be concise (2-3 paragraphs max)
- If the user asks for a recipe you found, include key details (ingredients, cook time)
- Stay conversational and helpful`;

async function handleRAGSearch(
  message: string,
  conversationId: string,
  userId: string,
  supabase: any,
  openRouter: OpenRouterClient
): Promise<string> {
  try {
    // Run hybrid search (semantic + text) in parallel
    let semanticResults: any[] = [];
    let textResults: any[] = [];

    // Generate embedding for semantic search
    try {
      const embedding = await openRouter.generateEmbedding(message);
      const { data, error } = await supabase.rpc("search_recipes_semantic", {
        query_embedding: JSON.stringify(embedding),
        user_id: userId,
        match_threshold: 0.5,
        match_count: 5,
      });
      if (!error && data) semanticResults = data;
    } catch (e) {
      console.warn("Semantic search failed (non-fatal):", e.message);
    }

    // Text search
    try {
      const { data, error } = await supabase.rpc("search_recipes_text", {
        search_query: message,
        user_uuid: userId,
        max_results: 5,
      });
      if (!error && data) textResults = data;
    } catch (e) {
      console.warn("Text search failed (non-fatal):", e.message);
    }

    // Combine and deduplicate (semantic results first — higher relevance)
    const seenIds = new Set<string>();
    const combinedResults: any[] = [];
    for (const r of [...semanticResults, ...textResults]) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        combinedResults.push(r);
      }
    }

    console.log(`RAG search: ${semanticResults.length} semantic + ${textResults.length} text → ${combinedResults.length} combined`);

    // Format results as context
    let recipeContext: string;
    if (combinedResults.length === 0) {
      recipeContext = "No matching recipes found in the user's collection.";
    } else {
      recipeContext = combinedResults.map((r: any) => {
        const parts = [`Recipe: ${r.title}`];
        if (r.description) parts.push(`Description: ${r.description}`);
        if (r.cuisine) parts.push(`Cuisine: ${r.cuisine}`);
        if (r.difficulty) parts.push(`Difficulty: ${r.difficulty}`);
        if (r.prep_time) parts.push(`Prep Time: ${r.prep_time}`);
        if (r.cook_time) parts.push(`Cook Time: ${r.cook_time}`);
        if (r.servings) parts.push(`Servings: ${r.servings}`);
        if (r.tags?.length) parts.push(`Tags: ${r.tags.join(", ")}`);
        if (r.ingredients) {
          const ingList = Array.isArray(r.ingredients)
            ? r.ingredients.map((i: any) =>
                typeof i === "string" ? i : `${i.amount || ""} ${i.unit || ""} ${i.name}`.trim()
              ).join(", ")
            : "";
          if (ingList) parts.push(`Ingredients: ${ingList}`);
        }
        return parts.join("\n");
      }).join("\n---\n");
    }

    // Get conversation history for context
    const { data: recentMessages } = await supabase
      .from("chat_messages")
      .select("content, sender")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(6);

    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));

    // Generate response with recipe context
    const augmentedMessage = `User question: ${message}\n\n--- Search Results (${combinedResults.length} recipes found) ---\n${recipeContext}`;

    const response = await openRouter.chatWithHistory(
      RAG_RESPONSE_PROMPT,
      conversationHistory,
      augmentedMessage,
      "qwen/qwen-2.5-7b-instruct",
      { temperature: 0.5, max_tokens: 800 }
    );

    return response;
  } catch (error) {
    console.error("RAG search error:", error);
    return "I had trouble searching your recipes. Please try again.";
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Health check (no auth)
    if (method === "GET" && path.includes("/health")) {
      let openRouterOk = false;
      try {
        createOpenRouterClient();
        openRouterOk = true;
      } catch { /* key not set */ }

      return corsResponse({
        status: "OK",
        timestamp: new Date().toISOString(),
        openRouterConfigured: openRouterOk,
      });
    }

    // Auth required for everything else
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return corsError("Authentication required", 401);

    const userToken = authHeader.replace("Bearer ", "");
    const auth = await getUserFromToken(userToken);
    if (!auth) return corsError("Invalid or expired token", 401);

    const { user, supabase } = auth;

    let openRouter: OpenRouterClient;
    try {
      openRouter = createOpenRouterClient();
    } catch {
      return corsError("OpenRouter API key not configured", 500);
    }

    // Route handling
    if (method === "POST" && path.includes("/message")) {
      return await handleSendMessage(req, supabase, user, openRouter, userToken);
    } else if (method === "GET" && path.includes("/history")) {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      return await handleGetHistory(req, supabase, user, limit);
    } else if (method === "DELETE" && path.includes("/history")) {
      return await handleClearHistory(req, supabase, user);
    }

    return corsError("Route not found", 404);
  } catch (error) {
    console.error("Server error:", error);
    return corsError(error.message, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// HANDLE SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════

async function handleSendMessage(
  req: Request,
  supabase: any,
  user: any,
  openRouter: OpenRouterClient,
  userToken: string
) {
  try {
    const {
      message,
      context,
      sessionId,
      intent: manualIntent,
      images = [],
    } = await req.json();

    if (!message && images.length === 0) {
      return corsError("Message or images required", 400);
    }

    // Get or create conversation
    let conversationId: string;
    const session_id = sessionId || context?.sessionId || `session-${Date.now()}`;

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
      // Placeholder title — will be replaced by AI-generated title after first response
      const placeholderTitle =
        message?.length > 50
          ? message.substring(0, 50) + "..."
          : message || "New conversation";
      const { data: newConv, error: convError } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: user.id,
          title: placeholderTitle,
          session_id,
          selected_intent: manualIntent || null,
          metadata: context?.metadata || {},
        })
        .select()
        .single();

      if (convError) throw convError;
      conversationId = newConv.id;
    }

    const isFirstMessage = !existingConv || !!findError;

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      content: message || "[Images only]",
      sender: "user",
      message_type: "text",
      metadata: { images: images.length, hasImages: images.length > 0 },
    });

    // ── Intent routing ──
    const startTime = Date.now();
    let routingIntent: string;
    let intentMetadata: any = {};

    if (manualIntent) {
      routingIntent = manualIntent;
      intentMetadata = { source: "manual", intent: manualIntent };
    } else {
      const intentResult = await detectIntent(message || "", images, openRouter);
      routingIntent = intentResult.intent;
      intentMetadata = {
        source: "ai",
        detectedIntent: intentResult.intent,
        reason: intentResult.reason,
        confidence: intentResult.confidence,
      };
    }

    // ── Route to service ──
    let aiResponse: string;
    let recipe: any = null;

    if (routingIntent === "recipe_extraction") {
      const extractionResult = await extractRecipe(message || "", images, userToken);
      if (extractionResult.success) {
        recipe = extractionResult.recipe;
        aiResponse = extractionResult.source_url
          ? `I've fetched and extracted the recipe from that URL! Here's what I found:`
          : "I've extracted the recipe! Here's what I found:";
      } else {
        aiResponse = `I had trouble extracting the recipe: ${extractionResult.error}`;
      }
    } else if (routingIntent === "rag_search") {
      aiResponse = await handleRAGSearch(message || "", conversationId, user.id, supabase, openRouter);
    } else {
      aiResponse = await handleGeneralChat(message || "", conversationId, supabase, openRouter);
    }

    const routingDuration = Date.now() - startTime;

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

    // Generate a smart title for new conversations (non-blocking on failure)
    let generatedTitle: string | undefined;
    if (isFirstMessage) {
      try {
        const titleResponse = await openRouter.chat(
          "Generate a very short title (4-6 words max) for this conversation. Return ONLY the title text, nothing else.",
          `User: ${(message || "").substring(0, 200)}\nAssistant: ${aiResponse.substring(0, 200)}`,
          "qwen/qwen-2.5-7b-instruct",
          { temperature: 0.3, max_tokens: 20 }
        );
        generatedTitle = titleResponse.trim().replace(/^["']|["']$/g, "");
        if (generatedTitle) {
          await supabase
            .from("chat_conversations")
            .update({ title: generatedTitle })
            .eq("id", conversationId);
        }
      } catch (e) {
        console.warn("Title generation failed (non-fatal):", e.message);
      }
    }

    return corsResponse({
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
      title: generatedTitle,
    });
  } catch (error) {
    console.error("handleSendMessage error:", error);
    return corsError(error.message, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLE GET HISTORY
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

      return corsResponse({ messages: formattedMessages });
    }

    const { data: conversations, error } = await supabase
      .from("chat_conversations")
      .select("id, title, session_id, selected_intent, created_at, updated_at, last_message_at")
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
      countsMap.set(msg.conversation_id, (countsMap.get(msg.conversation_id) || 0) + 1);
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

    return corsResponse({ conversations: formattedConversations });
  } catch (error) {
    return corsError(error.message, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLE CLEAR HISTORY
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
      return corsResponse({ message: "Conversation deleted successfully" });
    }

    const { error } = await supabase
      .from("chat_conversations")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;
    return corsResponse({ message: "Chat history cleared successfully" });
  } catch (error) {
    return corsError(error.message, 500);
  }
}
