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

async function extractRecipe(
  message: string,
  images: string[],
  userToken: string
): Promise<{ success: boolean; recipe?: any; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const pipelineUrl = `${supabaseUrl}/functions/v1/recipe-pipeline/extract-only`;

    const response = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify({
        source_type: "text",
        text: message || "",
        images: images,
        auto_save: false,
      }),
      signal: AbortSignal.timeout(25000),
    });

    const result = await response.json();

    if (result.success && result.recipe) {
      console.log("Recipe extracted via pipeline:", result.recipe.title);
      return { success: true, recipe: result.recipe };
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
    const { data: recentMessages } = await supabase
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

    return response;
  } catch (error) {
    console.error("General chat error:", error);
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
    return "Recipe search is temporarily unavailable. The n8n webhook URL is not configured.";
  }

  if (n8nUrl.includes("localhost") || n8nUrl.includes("127.0.0.1")) {
    console.warn("N8N_RAG_WEBHOOK_URL uses localhost — only works locally");
  }

  try {
    const response = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId, conversationId, userId }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n webhook failed: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data.content || data.message || data.output || data.response || text;
    } catch {
      return text;
    }
  } catch (error) {
    console.error("RAG workflow error:", error);

    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return "Recipe search timed out. Please try again.";
    }
    if (error.message.includes("Failed to fetch") || error.message.includes("ECONNREFUSED")) {
      return "Recipe search is unavailable. Cannot connect to n8n instance.";
    }

    return "I had trouble searching your recipes. Please try again later.";
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
        n8nConfigured: !!Deno.env.get("N8N_RAG_WEBHOOK_URL"),
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
        aiResponse = "I've extracted the recipe! Here's what I found:";
      } else {
        aiResponse = `I had trouble extracting the recipe: ${extractionResult.error}`;
      }
    } else if (routingIntent === "rag_search") {
      aiResponse = await callRAGWorkflow(message || "", session_id, conversationId, user.id);
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
