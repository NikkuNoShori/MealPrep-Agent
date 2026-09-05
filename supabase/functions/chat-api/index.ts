// Supabase Edge Function for Chat API
// MOP-0008: replaced single-shot intent router with tool-using agent loop.
// Delegates recipe extraction to the recipe-pipeline edge function via tool.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, corsError } from "../_shared/cors.ts";
import { getUserFromToken } from "../_shared/supabase-client.ts";
import {
  OpenRouterClient,
  createOpenRouterClient,
  type ChatMessage,
} from "../_shared/openrouter-client.ts";
import { runAgentLoop } from "./agent-loop.ts";
import { executeConfirmedTool } from "./tools/handlers.ts";
import type { ToolContext } from "./tools/dispatch.ts";
import { enrichMessageContent } from "./conversation-context.ts";
import { handleBatchExtract } from "./batch-extract.ts";

// ═══════════════════════════════════════════════════════════════════
// SSE HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Encode one SSE event as a UTF-8 byte chunk. */
function sseEvent(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Persist client-side extractions (e.g. video intake) — no OpenRouter needed
    if (method === "POST" && path.includes("/persist-extraction")) {
      return await handlePersistExtraction(req, supabase, user);
    }

    // MOP-0019 — Batch recipe import (SSE-streamed multi-URL extraction)
    if (method === "POST" && path.includes("/batch-extract")) {
      return await handleBatchExtract(req, supabase, user, userToken);
    }

    let openRouter: OpenRouterClient;
    try {
      openRouter = createOpenRouterClient();
    } catch {
      return corsError("OpenRouter API key not configured", 500);
    }

    // Route handling
    if (method === "POST" && path.includes("/message")) {
      const wantsStream = req.headers.get("Accept")?.includes("text/event-stream") ?? false;
      return await handleSendMessage(req, supabase, user, openRouter, userToken, wantsStream);
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
  userToken: string,
  stream = false
) {
  try {
    const {
      message,
      context,
      sessionId,
      intent: manualIntent,
      images = [],
    } = await req.json();

    // Allow confirmAction-only turns (user clicks Confirm on a pending action
    // when no new prose is needed). In that case message may be empty.
    const confirmAction = context?.confirmAction as
      | { tool: string; args: Record<string, unknown>; idempotencyKey?: string }
      | undefined;

    if (!message && images.length === 0 && !confirmAction) {
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

    // Upload chat images to Supabase Storage and collect public URLs
    const imageUrls: string[] = [];
    if (images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        try {
          const base64Data = images[i];
          // Extract mime type and raw base64
          const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
          if (!mimeMatch) continue;
          const mimeType = mimeMatch[1];
          const ext = mimeType.split("/")[1] || "jpg";
          const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
          const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

          const filePath = `chat/${user.id}/${conversationId}/${Date.now()}-${i}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("chat-images")
            .upload(filePath, bytes, { contentType: mimeType, upsert: false });

          if (uploadError) {
            console.warn(`Chat image upload failed: ${uploadError.message}`);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("chat-images")
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            imageUrls.push(urlData.publicUrl);
          }
        } catch (e) {
          console.warn(`Failed to upload chat image ${i}:`, e.message);
        }
      }
    }

    // Save user message with image URLs in metadata
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      content: message || "[Images only]",
      sender: "user",
      message_type: "text",
      metadata: {
        imagesCount: images.length,
        hasImages: images.length > 0,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      },
    });

    // ── MOP-0008: tool-using agent loop ──
    const startTime = Date.now();

    // Recent conversation history → ChatMessage[]
    const { data: recentMessages } = await supabase
      .from("chat_messages")
      .select("content, sender, created_at, metadata")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const conversationHistory: ChatMessage[] = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: (msg.sender === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: enrichMessageContent(msg),
      }));

    const toolCtx: ToolContext = {
      user: { id: user.id, email: user.email },
      supabase,
      openRouter,
      userToken,
      attachedImages: imageUrls.length > 0 ? imageUrls : images,
    };

    // ── Run agent (streaming or non-streaming) ──────────────────────
    if (stream) {
      // SSE path: return a ReadableStream immediately; run the agent inside
      // the stream controller so deltas flow to the client in real-time.
      const readableStream = new ReadableStream({
        async start(controller) {
          const enqueue = (data: unknown) => {
            try { controller.enqueue(sseEvent(data)); } catch { /* closed */ }
          };

          try {
            let aiResponse: string;
            let recipe: any = null;
            let recipes: any[] | null = null;
            let pendingConfirmation: any = null;
            let toolCallsTrace: any[] = [];
            let iterations = 0;
            let hitMaxIters = false;
            let confirmActionResult: any = null;

            if (confirmAction) {
              const result = await executeConfirmedTool(
                confirmAction.tool, confirmAction.args || {}, toolCtx
              );
              confirmActionResult = result;
              const r = result as { ok?: boolean; error?: string };
              aiResponse = r?.ok === false
                ? `That didn't work: ${r.error || "unknown error"}.`
                : `Done — I applied that change.`;
              toolCallsTrace = [{ name: confirmAction.tool, args: confirmAction.args, ok: r?.ok !== false, confirmed: true }];
              // Emit the short response as a single delta.
              enqueue({ type: "delta", text: aiResponse });
            } else {
              const agentReply = await runAgentLoop(
                { message: message || "", images, conversationHistory,
                  onDelta: (text) => enqueue({ type: "delta", text }) },
                toolCtx, openRouter
              );
              aiResponse = agentReply.content;
              recipe = agentReply.recipe || null;
              recipes = agentReply.recipes || null;
              pendingConfirmation = agentReply.pendingConfirmation || null;
              toolCallsTrace = agentReply.toolCalls;
              iterations = agentReply.iterations;
              hitMaxIters = agentReply.hitMaxIters;
            }

            const routingDuration = Date.now() - startTime;
            const intentMetadata = {
              source: "agent", manualIntent: manualIntent || null,
              toolCalls: toolCallsTrace, iterations, hitMaxIters,
              confirmAction: confirmActionResult ? true : undefined,
            };

            // Persist AI message.
            const { data: aiMessage } = await supabase
              .from("chat_messages").insert({
                conversation_id: conversationId,
                content: aiResponse, sender: "ai",
                message_type: recipe ? "recipe" : "text",
                metadata: { ...intentMetadata, recipe, recipes, pendingConfirmation, routingDuration },
              }).select().single();

            // Generate title (non-blocking).
            let generatedTitle: string | undefined;
            if (isFirstMessage) {
              try {
                const t = await openRouter.chat(
                  "Generate a very short title (4-6 words max) for this conversation. Return ONLY the title text, nothing else.",
                  `User: ${(message || "").substring(0, 200)}\nAssistant: ${aiResponse.substring(0, 200)}`,
                  "qwen/qwen-2.5-7b-instruct",
                  { temperature: 0.3, max_tokens: 20, billing: "chat" }
                );
                generatedTitle = t.trim().replace(/^["']|["']$/g, "");
                if (generatedTitle) {
                  await supabase.from("chat_conversations")
                    .update({ title: generatedTitle }).eq("id", conversationId);
                }
              } catch (e) { console.warn("Title generation failed:", e.message); }
            }

            // Terminal SSE events.
            if (recipe) enqueue({ type: "recipe", recipe });
            if (recipes && recipes.length > 1) enqueue({ type: "recipes", recipes });
            if (pendingConfirmation) enqueue({ type: "confirmation", pendingConfirmation });
            enqueue({
              type: "done",
              messageId: aiMessage?.id,
              conversationId,
              sessionId: session_id,
              intentMetadata,
              title: generatedTitle,
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("SSE agent error:", msg);
            try { controller.enqueue(sseEvent({ type: "error", message: msg })); } catch { /* closed */ }
          } finally {
            try { controller.close(); } catch { /* already closed */ }
          }
        },
      });

      return new Response(readableStream, { headers: SSE_HEADERS });
    }

    // ── Non-streaming (JSON) path — unchanged ───────────────────────
    let aiResponse: string;
    let recipe: any = null;
    let recipes: any[] | null = null;
    let pendingConfirmation: any = null;
    let toolCallsTrace: any[] = [];
    let iterations = 0;
    let hitMaxIters = false;
    let confirmActionResult: any = null;

    if (confirmAction) {
      // ── Confirmation short-circuit: run the previously-validated tool. ──
      console.log("[chat-api] confirmAction received:", confirmAction.tool);
      const result = await executeConfirmedTool(
        confirmAction.tool,
        confirmAction.args || {},
        toolCtx
      );
      confirmActionResult = result;
      const r = result as { ok?: boolean; error?: string };
      if (r?.ok === false) {
        aiResponse = `That didn't work: ${r.error || "unknown error"}.`;
      } else {
        aiResponse = `Done — I applied that change.`;
      }
      toolCallsTrace = [
        {
          name: confirmAction.tool,
          args: confirmAction.args,
          ok: r?.ok !== false,
          confirmed: true,
        },
      ];
    } else {
      // ── Standard agent loop ──
      const agentReply = await runAgentLoop(
        {
          message: message || "",
          images,
          conversationHistory,
        },
        toolCtx,
        openRouter
      );
      aiResponse = agentReply.content;
      recipe = agentReply.recipe || null;
      recipes = agentReply.recipes || null;
      pendingConfirmation = agentReply.pendingConfirmation || null;
      toolCallsTrace = agentReply.toolCalls;
      iterations = agentReply.iterations;
      hitMaxIters = agentReply.hitMaxIters;
    }

    const routingDuration = Date.now() - startTime;

    const intentMetadata = {
      source: "agent",
      manualIntent: manualIntent || null,
      toolCalls: toolCallsTrace,
      iterations,
      hitMaxIters,
      confirmAction: confirmActionResult ? true : undefined,
    };

    // Save AI response
    const { data: aiMessage } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        content: aiResponse,
        sender: "ai",
        message_type: recipe ? "recipe" : "text",
        metadata: {
          ...intentMetadata,
          recipe,
          recipes,
          pendingConfirmation,
          routingDuration,
        },
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
          { temperature: 0.3, max_tokens: 20, billing: "chat" }
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
      recipes: recipes && recipes.length > 1 ? recipes : undefined,
      pendingConfirmation: pendingConfirmation || undefined,
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

// ═══════════════════════════════════════════════════════════════════
// PERSIST CLIENT-SIDE EXTRACTION (video upload path → chat_messages)
// ═══════════════════════════════════════════════════════════════════

async function handlePersistExtraction(
  req: Request,
  supabase: any,
  user: { id: string }
) {
  try {
    const body = await req.json();
    const {
      sessionId,
      conversationId: requestedConversationId,
      userMessage,
      assistantContent,
      recipe,
      recipes,
      userMetadata,
      thumbnailUrl,
    } = body;

    if (!sessionId || !assistantContent) {
      return corsError("sessionId and assistantContent are required", 400);
    }

    let conversationId: string | undefined = requestedConversationId;

    if (conversationId) {
      const { data: owned } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!owned) conversationId = undefined;
    }

    if (!conversationId) {
      const { data: existingConv, error: findError } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv && !findError) {
        conversationId = existingConv.id;
      } else {
        const placeholderTitle =
          (userMessage as string | undefined)?.length > 50
            ? String(userMessage).substring(0, 50) + "..."
            : userMessage || "Video recipe extraction";
        const { data: newConv, error: convError } = await supabase
          .from("chat_conversations")
          .insert({
            user_id: user.id,
            title: placeholderTitle,
            session_id: sessionId,
            metadata: userMetadata || {},
          })
          .select()
          .single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }
    }

    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      content: userMessage || "[Video recipe intake]",
      sender: "user",
      message_type: "text",
      metadata: {
        ...(userMetadata || {}),
        source: "video_intake",
      },
    });

    const { data: aiMessage, error: aiError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        content: assistantContent,
        sender: "ai",
        message_type: recipe ? "recipe" : "text",
        metadata: {
          source: "video_intake",
          recipe: recipe || null,
          recipes: recipes || null,
          thumbnail_url: thumbnailUrl || recipe?.image_url || recipe?.imageUrl || null,
        },
      })
      .select()
      .single();

    if (aiError) throw aiError;

    await supabase
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return corsResponse({
      conversationId,
      response: {
        id: aiMessage.id,
        content: assistantContent,
        sender: "ai",
        timestamp: aiMessage.created_at,
      },
      recipe: recipe || undefined,
      recipes: recipes && recipes.length > 1 ? recipes : undefined,
    });
  } catch (error) {
    console.error("persist-extraction error:", error);
    return corsError(error.message || "Failed to persist extraction", 500);
  }
}
