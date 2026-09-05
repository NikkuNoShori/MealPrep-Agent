import React, { useState, useRef, useEffect, createRef } from 'react'
import { useQueryClient } from "@tanstack/react-query";
import { useSendMessage, useChatHistory } from "../../services/api";
import type { PendingConfirmation, ConfirmActionInput } from "../../services/api";
import { ConfirmationPrompt } from "./ConfirmationPrompt";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { apiClient } from "../../services/api";
import { detectIntent } from "../../services/ragService";
import { Logger } from "../../services/logger";
import { Button } from "../ui/button";
import { BatchImportPanel } from "./BatchImportPanel";
import {
  Send,
  Loader2,
  Bot,
  User,
  Plus,
  MessageSquare,
  Trash2,
  CheckSquare,
  Square,
  X,
  Image as ImageIcon,
  Film,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  PackagePlus,
} from "lucide-react";
import toast from "react-hot-toast";
import { ChatMessageResponse, StructuredRecipe } from "../../types";
import {
  mapPipelineToChatResponse,
  processVideoIntake,
} from "../../services/videoIntake";
import { validateIntakeVideoFile } from "../../utils/videoFrameExtractor";
import { useAuthStore } from "../../stores/authStore";
import { StructuredRecipeDisplay, StructuredRecipeDisplayHandle } from "./StructuredRecipeDisplay";
import {
  buildDraftRecipeKey,
  useDraftRecipeStore,
} from "@/stores/draftRecipeStore";

/** Maximum image file size in bytes (5MB) */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
/** Maximum image dimension for compression */
const MAX_IMAGE_DIMENSION = 1200;
/** JPEG compression quality */
const COMPRESSION_QUALITY = 0.8;

/** Client-side temp conversation ids are numeric timestamps. */
function isLocalTempConversationId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * Validate and compress an image file.
 * Returns the compressed File, or throws if invalid.
 */
async function validateAndCompressImage(file: File): Promise<File> {
  // Validate type
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" is not an image file`);
  }

  // Validate size (reject if over 5MB raw)
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
  }

  // Compress using canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // Fallback: return original if canvas fails
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          console.log(
            `Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${width}x${height})`
          );
          resolve(compressedFile);
        },
        "image/jpeg",
        COMPRESSION_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name}" could not be loaded — the file may be corrupt`));
    };

    img.src = url;
  });
}

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  images?: string[]; // Array of image URLs or base64 data URLs
  /** Set when user attached a recipe video for intake. */
  videoFileName?: string;
  recipe?: StructuredRecipe; // Optional structured recipe data
  recipes?: StructuredRecipe[]; // Optional multiple recipes
  previewImageDataUrl?: string;
  thumbnailUrl?: string;
  /**
   * Set when the agent emitted a destructive tool call that the user
   * must confirm before the backend will execute it. Rendered inline
   * via <ConfirmationPrompt/>. Cleared after Confirm or Cancel — see
   * handleConfirmAction / handleCancelConfirmation in ChatInterface.
   */
  pendingConfirmation?: PendingConfirmation;
  /**
   * When true, this is an optimistic placeholder bubble rendered while
   * the server is processing. It is replaced by the real AI message
   * when the response arrives and never persisted.
   */
  isThinking?: boolean;
}

function mapDbMessagesToLocal(messages: Array<Record<string, unknown>>): Message[] {
  return messages.map((msg) => ({
    id: String(msg.id),
    content: String(msg.content ?? ""),
    sender: msg.sender as "user" | "ai",
    timestamp: new Date(String(msg.timestamp)),
    images: (msg.metadata as { imageUrls?: string[] } | undefined)?.imageUrls,
    recipe: (msg.metadata as { recipe?: StructuredRecipe } | undefined)?.recipe,
    recipes: (msg.metadata as { recipes?: StructuredRecipe[] } | undefined)?.recipes,
    thumbnailUrl:
      (msg.metadata as { thumbnail_url?: string } | undefined)?.thumbnail_url ||
      (msg.metadata as { recipe?: { image_url?: string; imageUrl?: string } } | undefined)
        ?.recipe?.image_url ||
      (msg.metadata as { recipe?: { imageUrl?: string } } | undefined)?.recipe?.imageUrl,
    videoFileName: (msg.metadata as { videoFileName?: string } | undefined)?.videoFileName,
  }));
}

function collectRecipeDraftSlots(messages: Message[]): Array<{
  messageId: string;
  recipeIndex: number;
}> {
  const slots: Array<{ messageId: string; recipeIndex: number }> = [];
  for (const msg of messages) {
    if (msg.recipes && msg.recipes.length > 1) {
      msg.recipes.forEach((_, recipeIndex) => {
        slots.push({ messageId: msg.id, recipeIndex });
      });
    } else if (msg.recipe) {
      slots.push({ messageId: msg.id, recipeIndex: 0 });
    }
  }
  return slots;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: string;
  timestamp: Date;
  sessionId: string; // Session ID for conversation tracking
  isTemporary: boolean; // Track if session is temporary (not yet persisted)
  selectedIntent?: string | null; // Track manually selected intent (recipe_extraction or null for RAG queries)
}

export const ChatInterface: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking...");
  const [hasQueuedMessage, setHasQueuedMessage] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");
  const [selectedConversations, setSelectedConversations] = useState<
    Set<string>
  >(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [deleteConversationTarget, setDeleteConversationTarget] = useState<{ id: string; title: string } | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]); // Images to be sent with next message
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]); // Object URLs for image previews
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // Load saved width from localStorage or default to 320px (w-80)
    const saved = localStorage.getItem("chat-sidebar-width");
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  // On mobile the sidebar is an overlay drawer rather than an inline column,
  // so start collapsed there to avoid squeezing the chat down to a sliver.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queuedMessageRef = useRef<string | null>(null);
  const loadingConversationIdRef = useRef<string | null>(null);
  // Tracks whether the initial conversation load has completed. Subsequent
  // refetches of chat history (e.g. after sending a message) must not reset
  // local state — local handlers already keep conversations in sync.
  const hasInitializedRef = useRef(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  // Tracks the message id whose pendingConfirmation is currently being
  // dispatched, so the Confirm/Cancel buttons can show a busy state.
  const [confirmingMessageId, setConfirmingMessageId] = useState<string | null>(null);
  // MOP-0019 — Batch import panel visibility
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  const sendMessageMutation = useSendMessage();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    data: chatHistoryData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useChatHistory(50);

  // Get user's first name
  const getFirstName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.display_name) return user.display_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "there";
  };

  // Load conversations from database on component mount
  useEffect(() => {
    if (!user || isLoadingHistory) return; // Wait for user to be loaded and data to be fetched
    if (hasInitializedRef.current) return; // Already initialized; refetches must not reset state
    hasInitializedRef.current = true;

    const loadConversations = async () => {
      try {
        const historyData = chatHistoryData as any;
        if (
          historyData?.conversations &&
          Array.isArray(historyData.conversations) &&
          historyData.conversations.length > 0
        ) {
          // Convert database conversations to local format
          const loadedConversations: Conversation[] = await Promise.all(
            historyData.conversations.map(async (dbConv: any) => {
              // Load messages for this conversation
              let messages: Message[] = [];
              try {
                const messagesData = await apiClient.getConversationMessages(
                  dbConv.id
                );
                const messagesResponse = messagesData as any;
                if (
                  messagesResponse?.messages &&
                  Array.isArray(messagesResponse.messages)
                ) {
                  messages = mapDbMessagesToLocal(
                    messagesResponse.messages as Array<Record<string, unknown>>
                  );
                }
              } catch (error) {
                Logger.chat.error('loadMessages', error as Error, {
                  conversationId: dbConv.id,
                });
              }

              return {
                id: dbConv.id,
                title: dbConv.title,
                messages: messages,
                lastMessage:
                  messages.length > 0
                    ? messages[messages.length - 1].content
                    : "",
                timestamp: new Date(dbConv.lastMessageAt || dbConv.createdAt),
                sessionId: dbConv.sessionId,
                isTemporary: false, // All loaded from DB are persistent
                selectedIntent: dbConv.selectedIntent || null,
              };
            })
          );

          // Filter out conversations with no messages (shouldn't exist in DB, but just in case)
          const conversationsWithMessages = loadedConversations.filter(
            (conv) => conv.messages.length > 0
          );

          // Always start on a fresh new chat, with history available in sidebar
          const newSessionId = `session-${Date.now()}`;
          const freshChat: Conversation = {
            id: Date.now().toString(),
            title: "New Chat",
            messages: [],
            lastMessage: "",
            timestamp: new Date(),
            sessionId: newSessionId,
            isTemporary: true,
            selectedIntent: null,
          };
          setConversations([freshChat, ...conversationsWithMessages]);
          setCurrentConversationId(freshChat.id);
          Logger.chat.conversationCreated(freshChat.id, newSessionId, "New Chat", true);
        } else {
          // No conversations in database, create default
          createDefaultConversation();
        }
      } catch (error) {
        Logger.chat.error('loadConversations', error as Error);
        createDefaultConversation();
      }
    };

    loadConversations();
  }, [user, chatHistoryData, isLoadingHistory]);

  const createDefaultConversation = () => {
    const newSessionId = `session-${Date.now()}`;
    const defaultConversation: Conversation = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      lastMessage: "",
      timestamp: new Date(),
      sessionId: newSessionId,
      isTemporary: true, // Mark as temporary until first message
      selectedIntent: null, // No intent selected yet
    };
    setConversations([defaultConversation]);
    setCurrentConversationId(defaultConversation.id);
    Logger.chat.conversationCreated(defaultConversation.id, newSessionId, "New Chat", true);
  };

  // Refetch conversations when messages are sent (handled by mutation invalidation)
  // No need to save to localStorage - all conversations are stored in database

  // For conversations with messages but no selectedIntent (legacy conversations),
  // infer intent from first message or default to RAG queries
  useEffect(() => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.messages.length > 0 && conv.selectedIntent === undefined) {
          // Legacy conversation - default to RAG queries (null intent)
          return { ...conv, selectedIntent: null };
        }
        return conv;
      })
    );
  }, []);

  // No need to clean up temporary sessions - they're managed in database

  // No need to save current conversation ID to localStorage
  // It's managed in component state and restored from database

  useEffect(() => {
    scrollToBottom();
  }, [conversations, currentConversationId]);

  const scrollToBottom = () => {
    // Use scrollTop on the messages container directly instead of scrollIntoView
    // to prevent scroll propagation to parent containers (which clips the header)
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const getCurrentConversation = () => {
    return conversations.find((conv) => conv.id === currentConversationId);
  };

  const refreshConversationMessages = async (conversationId: string) => {
    if (isLocalTempConversationId(conversationId)) return;
    try {
      const messagesData = await apiClient.getConversationMessages(conversationId);
      const messagesResponse = messagesData as { messages?: Array<Record<string, unknown>> };
      if (!messagesResponse?.messages) return;

      const messages = mapDbMessagesToLocal(messagesResponse.messages);
      useDraftRecipeStore
        .getState()
        .remapConversationDrafts(conversationId, collectRecipeDraftSlots(messages));
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages,
                lastMessage:
                  messages.length > 0
                    ? messages[messages.length - 1].content
                    : conv.lastMessage,
              }
            : conv
        )
      );
    } catch (error) {
      Logger.chat.error("refreshConversationMessages", error as Error, {
        conversationId,
      });
    }
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setLoadingLabel("Thinking...");

    const convId = loadingConversationIdRef.current;
    if (!convId) return;

    const cancelledMessage: Message = {
      id: `cancelled-${Date.now()}`,
      content: "Generation stopped.",
      sender: "ai",
      timestamp: new Date(),
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === convId
          ? {
              ...conv,
              messages: [...conv.messages, cancelledMessage],
              lastMessage: cancelledMessage.content,
            }
          : conv
      )
    );
    loadingConversationIdRef.current = null;
  };

  const createNewConversation = () => {
    // Remove any temporary conversations with no messages
    setConversations((prev) =>
      prev.filter((conv) => !conv.isTemporary || conv.messages.length > 0)
    );

    const newSessionId = `session-${Date.now()}`;
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      lastMessage: "",
      timestamp: new Date(),
      sessionId: newSessionId,
      isTemporary: true, // Mark as temporary until first message
      selectedIntent: undefined, // No intent selected yet
    };
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setInputMessage("");
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    Logger.chat.conversationCreated(newConversation.id, newSessionId, "New Chat", true);
    Logger.chat.stateChange('conversation_switched', { conversationId: newConversation.id });
  };

  // Handle intent selection via button click
  const handleIntentSelection = (intent: "recipe_extraction" | null) => {
    if (!currentConversationId) return;

    Logger.chat.stateChange('intent_selected', {
      conversationId: currentConversationId,
      intent,
    });

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, selectedIntent: intent }
          : conv
      )
    );
  };

  const deleteConversation = async (conversationId: string) => {
    const conversation = conversations.find(
      (conv) => conv.id === conversationId
    );

    // If it's a temporary conversation with no messages, just remove from state
    if (conversation?.isTemporary && conversation.messages.length === 0) {
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );
      if (currentConversationId === conversationId) {
        const remainingConversations = conversations.filter(
          (conv) => conv.id !== conversationId
        );
        if (remainingConversations.length > 0) {
          setCurrentConversationId(remainingConversations[0].id);
        } else {
          createNewConversation();
        }
      }
      setDeleteConversationTarget(null);
      return;
    }

    // If it's in the database (has messages), delete it via API
    setIsDeletingConversation(true);
    try {
      await apiClient.deleteConversation(conversationId);
      useDraftRecipeStore.getState().clearConversationDrafts(conversationId);
      Logger.chat.conversationDeleted(conversationId);

      // Remove from state after successful API call
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );
      if (currentConversationId === conversationId) {
        const remainingConversations = conversations.filter(
          (conv) => conv.id !== conversationId
        );
        if (remainingConversations.length > 0) {
          setCurrentConversationId(remainingConversations[0].id);
          Logger.chat.stateChange('conversation_switched', { conversationId: remainingConversations[0].id });
        } else {
          createNewConversation();
        }
      }
      // Refetch to sync with database
      refetchHistory();
    } catch (error) {
      Logger.chat.error('deleteConversation', error as Error, { conversationId });
      toast.error("Couldn't delete conversation. Try again.");
      // Revert state change on error
      refetchHistory();
    } finally {
      setIsDeletingConversation(false);
      setDeleteConversationTarget(null);
    }
  };

  const deleteSelectedConversations = async () => {
    const conversationsToDelete = Array.from(selectedConversations);
    setIsDeletingConversation(true);

    // Delete each conversation from the database, tracking which ones
    // actually succeeded — a partial failure must not remove conversations
    // from local state that were never actually deleted server-side (that
    // silently desyncs the UI from the database with no error shown).
    const succeededIds = new Set<string>();
    const failedIds: string[] = [];

    const deletePromises = conversationsToDelete.map(async (conversationId) => {
      const conversation = conversations.find(
        (conv) => conv.id === conversationId
      );

      // Only call API for non-temporary conversations with messages;
      // temporary/empty ones never existed server-side, so they always
      // "succeed" locally.
      if (
        conversation &&
        !(conversation.isTemporary && conversation.messages.length === 0)
      ) {
        try {
          await apiClient.deleteConversation(conversationId);
          succeededIds.add(conversationId);
        } catch (error) {
          Logger.chat.error("deleteSelectedConversations", error as Error, { conversationId });
          failedIds.push(conversationId);
        }
      } else {
        succeededIds.add(conversationId);
      }
    });

    await Promise.all(deletePromises);

    // Remove only the conversations that were actually deleted.
    setConversations((prev) =>
      prev.filter((conv) => !succeededIds.has(conv.id))
    );

    // If current conversation was among the ones actually deleted, switch
    // to another one.
    if (currentConversationId && succeededIds.has(currentConversationId)) {
      const remainingConversations = conversations.filter(
        (conv) => !succeededIds.has(conv.id)
      );
      if (remainingConversations.length > 0) {
        setCurrentConversationId(remainingConversations[0].id);
      } else {
        createNewConversation();
      }
    }

    // Clear selection and exit multi-select mode
    setSelectedConversations(new Set());
    setIsMultiSelectMode(false);

    if (failedIds.length > 0) {
      toast.error(
        failedIds.length === 1
          ? "Couldn't delete 1 conversation. Try again."
          : `Couldn't delete ${failedIds.length} conversations. Try again.`
      );
    } else if (succeededIds.size > 0) {
      toast.success(
        succeededIds.size === 1 ? "Conversation deleted" : `${succeededIds.size} conversations deleted`
      );
    }

    // Refetch to sync with database
    refetchHistory();
    setIsDeletingConversation(false);
    setShowBulkDeleteConfirm(false);
  };

  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const selectAllConversations = () => {
    setSelectedConversations(new Set(conversations.map((conv) => conv.id)));
  };

  const clearSelection = () => {
    setSelectedConversations(new Set());
    setIsMultiSelectMode(false);
  };

  // Handle image / video file selection
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (videoFiles.length > 0) {
      try {
        validateIntakeVideoFile(videoFiles[0]);
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        setPendingVideo(videoFiles[0]);
        setVideoPreviewUrl(URL.createObjectURL(videoFiles[0]));
        toast.success(
          "Video attached — we'll transcribe voiceover and read on-screen text when you send."
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Invalid video file";
        toast.error(msg);
      }
    }

    // Limit to 4 images total
    const remainingSlots = 4 - pendingImages.length;
    const filesToAdd = imageFiles.slice(0, remainingSlots);

    // Validate and compress each image
    const processedFiles: File[] = [];
    for (const file of filesToAdd) {
      try {
        const compressed = await validateAndCompressImage(file);
        processedFiles.push(compressed);
      } catch (error: any) {
        toast.error(error.message || "Invalid image file");
      }
    }

    if (processedFiles.length > 0) {
      setPendingImages((prev) => [...prev, ...processedFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle paste images from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));

    if (imageItems.length > 0 && pendingImages.length < 4) {
      const remainingSlots = 4 - pendingImages.length;
      const itemsToProcess = imageItems.slice(0, remainingSlots);

      for (const item of itemsToProcess) {
        const file = item.getAsFile();
        if (file) {
          try {
            const compressed = await validateAndCompressImage(file);
            setPendingImages((prev) => [...prev, compressed]);
          } catch (error: any) {
            toast.error(error.message || "Invalid pasted image");
          }
        }
      }
    }
  };

  const removeVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setPendingVideo(null);
  };

  // Remove image from pending list
  const removeImage = (index: number) => {
    // Revoke object URL for removed image
    if (imagePreviewUrls[index]) {
      URL.revokeObjectURL(imagePreviewUrls[index]);
      setImagePreviewUrls((prevUrls) => prevUrls.filter((_, i) => i !== index));
    }
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Create object URLs when pendingImages change. The cleanup function
  // revokes the URLs from the previous render, so we don't need to read
  // imagePreviewUrls inside the effect body.
  useEffect(() => {
    const newUrls = pendingImages.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls(newUrls);

    return () => {
      newUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [pendingImages]);

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem("chat-sidebar-width", sidebarWidth.toString());
  }, [sidebarWidth]);

  // Track the mobile breakpoint (matches the `md:` breakpoint used elsewhere,
  // e.g. Header.tsx) so the sidebar can switch between an inline column and
  // an overlay drawer.
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Constrain between 240px (min) and 600px (max)
      const constrainedWidth = Math.max(240, Math.min(600, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Convert File to base64 data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async () => {
    const messageText = inputMessage.trim();

    if (
      (!messageText && pendingImages.length === 0 && !pendingVideo) ||
      !currentConversationId
    ) {
      return;
    }

    // Queue a follow-up text message while a response is in flight.
    if (isLoading) {
      if (messageText && pendingImages.length === 0 && !pendingVideo) {
        queuedMessageRef.current = messageText;
        setHasQueuedMessage(true);
        setInputMessage("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        toast.success("Message queued — will send when the current response finishes");
      }
      return;
    }

    const currentConversation = getCurrentConversation();
    if (!currentConversation) {
      Logger.chat.error('sendMessage', new Error('No current conversation'), { currentConversationId });
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;
    loadingConversationIdRef.current = currentConversationId;

    // Use manually selected intent (or null for RAG queries)
    const intent = currentConversation.selectedIntent || null;
    Logger.chat.stateChange('message_sending', {
      conversationId: currentConversationId,
      intent,
      hasImages: pendingImages.length > 0,
      messageLength: messageText.length,
    });

    // Capture outbound content before clearing composer state.
    const videoForIntake = pendingVideo;
    const displayContent =
      messageText ||
      (videoForIntake ? `Recipe video: ${videoForIntake.name}` : "");

    // Add message to history
    setMessageHistory((prev) => [
      messageText || displayContent,
      ...prev.filter((msg) => msg !== messageText && msg !== displayContent),
    ]);
    setHistoryIndex(-1);
    setTempInput("");

    // Convert images to data URLs
    const imageDataUrls = await Promise.all(
      pendingImages.map((file) => fileToDataURL(file))
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      content: displayContent,
      sender: "user",
      timestamp: new Date(),
      images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
      videoFileName: videoForIntake?.name,
    };

    // Update conversation with user message and persist if temporary
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              lastMessage: displayContent,
              timestamp: new Date(),
              title:
                conv.messages.length === 0
                  ? (() => {
                      if (messageText) {
                        return messageText.slice(0, 30) + (messageText.length > 30 ? "..." : "");
                      } else if (pendingImages.length > 0) {
                        return `${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''}`;
                      } else if (videoForIntake) {
                        return `Video: ${videoForIntake.name.slice(0, 24)}`;
                      } else {
                        return "New conversation";
                      }
                    })()
                  : conv.title,
              isTemporary: false, // Persist the session when first message is sent
            }
          : conv
      )
    );

    setInputMessage("");
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // Revoke all image preview URLs before clearing
    imagePreviewUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    setImagePreviewUrls([]);
    setPendingImages([]); // Clear images after adding to message
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setPendingVideo(null);
    setIsLoading(true);
    setLoadingLabel(
      videoForIntake
        ? "Transcribing video and extracting recipe..."
        : "Thinking..."
    );

    // Optimistic placeholder — shows an AI "thinking" bubble immediately so
    // the user sees acknowledgment before the server responds.
    const thinkingMessage: Message = {
      id: "ai-thinking-placeholder",
      content: "",
      sender: "ai",
      timestamp: new Date(),
      isThinking: true,
    };
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, thinkingMessage] }
          : conv
      )
    );

    try {
      let response: ChatMessageResponse;
      let videoMessagesSynced = false;

      if (videoForIntake) {
        toast.loading("Extracting recipe from video (transcription + frames)...", {
          id: "video-intake",
        });
        try {
          const intakeOutcome = await processVideoIntake({
            message: messageText,
            videoFile: videoForIntake,
            autoSave: false,
            signal,
          });
          if (signal.aborted) return;
          response = mapPipelineToChatResponse(intakeOutcome);

          // Persist to chat_messages so follow-ups include structured recipe context
          try {
            const persisted = await apiClient.persistChatExtraction({
              sessionId: currentConversation.sessionId,
              conversationId: isLocalTempConversationId(currentConversationId)
                ? undefined
                : currentConversationId,
              userMessage: displayContent,
              assistantContent: response.response.content,
              recipe: response.recipe as Record<string, unknown> | undefined,
              recipes: response.recipes as Record<string, unknown>[] | undefined,
              userMetadata: { videoFileName: videoForIntake.name },
              thumbnailUrl: response.thumbnailUrl,
              signal,
            });
            if (signal.aborted) return;

            if (persisted.response?.id) {
              response.response.id = persisted.response.id;
              response.response.timestamp = persisted.response.timestamp;
            }

            const resolvedId = persisted.conversationId || currentConversationId;
            if (
              persisted.conversationId &&
              persisted.conversationId !== currentConversationId
            ) {
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.id === currentConversationId
                    ? {
                        ...conv,
                        id: persisted.conversationId!,
                        isTemporary: false,
                      }
                    : conv
                )
              );
              setCurrentConversationId(persisted.conversationId);
              loadingConversationIdRef.current = persisted.conversationId;
            }

            await refreshConversationMessages(resolvedId);
            videoMessagesSynced = true;
            await queryClient.invalidateQueries({ queryKey: ["chat", "history"] });
          } catch (persistErr) {
            if (!signal.aborted) {
              console.warn("Failed to persist video extraction to chat:", persistErr);
            }
          }

          if (!videoMessagesSynced && !signal.aborted) {
            const responseRecipes = response.recipes;
            const aiMessage: Message = {
              id: response.response.id,
              content: response.response.content,
              sender: "ai",
              timestamp: new Date(response.response.timestamp),
              recipe: response.recipe,
              recipes:
                responseRecipes && responseRecipes.length > 1
                  ? responseRecipes
                  : undefined,
              previewImageDataUrl: response.previewImageDataUrl,
              thumbnailUrl: response.thumbnailUrl,
            };
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === currentConversationId
                  ? {
                      ...conv,
                      messages: [...conv.messages, aiMessage],
                      lastMessage: response.response.content,
                    }
                  : conv
              )
            );
          }
        } finally {
          toast.dismiss("video-intake");
        }
        return;
      } else if (intent === "recipe_extraction") {
        // Handle recipe extraction
        Logger.chat.stateChange('recipe_extraction_started', {
          conversationId: currentConversationId,
          hasImages: imageDataUrls.length > 0,
        });
        const messageData: {
          message: string;
          sessionId: string;
          intent: string;
          images?: string[];
          context: any;
          signal?: AbortSignal;
        } = {
          message: messageText,
          sessionId: currentConversation.sessionId,
          intent: "recipe_extraction",
          context: {
            recentMessages: currentConversation.messages.slice(-5),
            conversationId: currentConversationId,
          },
          signal,
        };
        if (imageDataUrls.length > 0) {
          messageData.images = imageDataUrls;
        }
        const sendResponse = (await sendMessageMutation.mutateAsync(
          messageData
        )) as ChatMessageResponse & {
          conversationId?: string;
          sessionId?: string;
        };
        if (signal.aborted) return;

        // Update conversation ID if this is a new conversation (from database)
        if (sendResponse.conversationId && currentConversation.isTemporary) {
          Logger.chat.stateChange('conversation_persisted', {
            oldId: currentConversationId,
            newId: sendResponse.conversationId,
          });
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === currentConversationId
                ? {
                    ...conv,
                    id: sendResponse.conversationId!,
                    isTemporary: false,
                  }
                : conv
            )
          );
          setCurrentConversationId(sendResponse.conversationId);
        }

        // Update sessionId if provided
        if (
          sendResponse.sessionId &&
          sendResponse.sessionId !== currentConversation.sessionId
        ) {
          Logger.chat.stateChange('sessionId_updated', {
            conversationId: sendResponse.conversationId || currentConversationId,
            oldSessionId: currentConversation.sessionId,
            newSessionId: sendResponse.sessionId,
          });
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === (sendResponse.conversationId || currentConversationId)
                ? { ...conv, sessionId: sendResponse.sessionId! }
                : conv
            )
          );
        }

        response = sendResponse;
      } else {
        // ── MOP-0017: SSE streaming path for general chat and RAG queries ──
        // Server performs AI-powered intent detection; we stream the prose reply
        // and update the thinking-placeholder in real-time as deltas arrive.
        const detectedIntent = detectIntent(inputMessage);
        Logger.chat.intentDetected(detectedIntent, 0.8, 'Client-side hint (server will make final decision)', inputMessage);

        const intentToSend =
          detectedIntent === "recipe_extraction"
            ? "recipe_extraction"
            : undefined;

        const messageData = {
          message: messageText,
          sessionId: currentConversation.sessionId,
          intent: intentToSend,
          images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
          context: {
            recentMessages: currentConversation.messages.slice(-5),
            conversationId: currentConversationId,
            clientDetectedIntent: detectedIntent,
          },
          signal,
        };

        // Accumulate stream state — populated by SSE callbacks.
        let streamedContent = "";
        let streamedRecipe: any = null;
        let streamedRecipes: any[] | null = null;
        let streamedConfirmation: any = null;
        let doneEvent: any = null;

        await apiClient.sendMessageStream(messageData, {
          onEvent: (event) => {
            if (signal.aborted) return;

            if (event.type === "delta") {
              streamedContent += event.text;
              // Update the thinking-placeholder in-place so the bubble fills
              // character-by-character without re-mounting the component.
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.id === currentConversationId
                    ? {
                        ...conv,
                        messages: conv.messages.map((m) =>
                          m.id === "ai-thinking-placeholder"
                            ? { ...m, content: streamedContent, isThinking: false }
                            : m
                        ),
                      }
                    : conv
                )
              );
            } else if (event.type === "recipe") {
              streamedRecipe = event.recipe;
            } else if (event.type === "recipes") {
              streamedRecipes = event.recipes;
            } else if (event.type === "confirmation") {
              streamedConfirmation = event.pendingConfirmation;
            } else if (event.type === "done") {
              doneEvent = event;
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          },
        });

        if (signal.aborted) return;

        // Construct a synthetic ChatMessageResponse so the code below that
        // replaces the placeholder and updates conversation state is unchanged.
        const doneConversationId: string = doneEvent?.conversationId ?? currentConversationId;
        const doneSessionId: string = doneEvent?.sessionId ?? currentConversation.sessionId;

        // Persist the new conversationId if this was a temporary conversation.
        if (doneConversationId !== currentConversationId && currentConversation.isTemporary) {
          Logger.chat.stateChange('conversation_persisted', {
            oldId: currentConversationId,
            newId: doneConversationId,
          });
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === currentConversationId
                ? { ...conv, id: doneConversationId, isTemporary: false }
                : conv
            )
          );
          setCurrentConversationId(doneConversationId);
        }

        // Update sessionId if it changed.
        if (doneSessionId && doneSessionId !== currentConversation.sessionId) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === doneConversationId
                ? { ...conv, sessionId: doneSessionId }
                : conv
            )
          );
        }

        // The local ChatMessageResponse type (from ../../types) is the slim
        // frontend-only shape. Extra fields (conversationId, title, etc.) are
        // accessed via the `as any` casts already present in the shared path
        // below — so we cast here to satisfy TS while carrying the extras.
        response = {
          response: {
            id: doneEvent?.messageId ?? `stream-${Date.now()}`,
            content: streamedContent,
            timestamp: new Date().toISOString(),
          },
          recipe: streamedRecipe ?? undefined,
          recipes: streamedRecipes ?? undefined,
          // Carry extras via type assertion — consumed below as (response as any).xxx
          ...({
            pendingConfirmation: streamedConfirmation ?? undefined,
            conversationId: doneConversationId,
            sessionId: doneSessionId,
            intentMetadata: doneEvent?.intentMetadata,
            title: doneEvent?.title,
          } as any),
        };
      }

      if (signal.aborted) return;

      // Handle multi-recipe or single recipe response
      const responseRecipes = (response as any).recipes as StructuredRecipe[] | undefined;
      const aiMessage: Message = {
        id: response.response.id,
        content: response.response.content,
        sender: "ai",
        timestamp: new Date(response.response.timestamp),
        recipe: response.recipe, // Include structured recipe if present (backwards compat)
        recipes: responseRecipes && responseRecipes.length > 1 ? responseRecipes : undefined,
        previewImageDataUrl: (response as ChatMessageResponse).previewImageDataUrl,
        thumbnailUrl: (response as ChatMessageResponse).thumbnailUrl,
        // MOP-0008 Step 8 — surfaced when the agent proposed a destructive tool
        pendingConfirmation: (response as any).pendingConfirmation,
      };

      // Log successful response
      if (responseRecipes && responseRecipes.length > 1) {
        responseRecipes.forEach((r) => {
          Logger.chat.recipeExtracted(
            currentConversationId,
            r.title || 'Unknown',
            true
          );
        });
      } else if (response.recipe) {
        Logger.chat.recipeExtracted(
          currentConversationId,
          response.recipe.title || 'Unknown',
          true
        );
      }

      // Update conversation with AI response and title if returned.
      // When the conversation was just persisted, its local id was swapped
      // from the temp value to the server-issued UUID — use that resolved id
      // here so the AI message attaches to the correct conversation.
      const resolvedConversationId =
        ((response as any).conversationId as string | undefined) ||
        currentConversationId;
      const serverTitle = (response as any).title;
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === resolvedConversationId
            ? {
                ...conv,
                // Replace the optimistic thinking placeholder with the real message.
                messages: [
                  ...conv.messages.filter((m) => m.id !== "ai-thinking-placeholder"),
                  aiMessage,
                ],
                lastMessage: response.response.content,
                ...(serverTitle ? { title: serverTitle } : {}),
              }
            : conv
        )
      );

      Logger.chat.stateChange('message_received', {
        conversationId: currentConversationId,
        hasRecipe: !!response.recipe,
        recipeCount: responseRecipes?.length || (response.recipe ? 1 : 0),
      });
    } catch (error) {
      if (signal.aborted) return;

      Logger.chat.error('sendMessage', error as Error, {
        conversationId: currentConversationId,
        sessionId: currentConversation?.sessionId,
        messageLength: messageText.length,
        imageCount: imageDataUrls.length,
        hadVideo: !!videoForIntake,
      });
      const errText =
        error instanceof Error ? error.message : "Unknown error";
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: videoForIntake
          ? `Video extraction failed: ${errText}`
          : "Sorry, I encountered an error. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [
                  ...conv.messages.filter((m) => m.id !== "ai-thinking-placeholder"),
                  errorMessage,
                ],
                lastMessage: "Error occurred",
              }
            : conv
        )
      );
    } finally {
      abortControllerRef.current = null;
      loadingConversationIdRef.current = null;
      setIsLoading(false);
      setLoadingLabel("Thinking...");

      const queued = queuedMessageRef.current;
      if (queued) {
        queuedMessageRef.current = null;
        setHasQueuedMessage(false);
        setInputMessage(queued);
        setTimeout(() => {
          void handleSendMessage();
        }, 0);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "ArrowUp") {
      // Only trigger history navigation when the cursor is on the first line
      // (or the textarea is empty). Otherwise let the caret move normally.
      const ta = e.currentTarget as HTMLTextAreaElement;
      const textBeforeCursor = ta.value.slice(0, ta.selectionStart ?? 0);
      const isOnFirstLine = !textBeforeCursor.includes("\n");
      if (isOnFirstLine && historyIndex < messageHistory.length - 1) {
        e.preventDefault();
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        if (newIndex === 0) {
          setTempInput(inputMessage);
        }
        setInputMessage(messageHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      // Only trigger history navigation when the cursor is on the last line.
      const ta = e.currentTarget as HTMLTextAreaElement;
      const textAfterCursor = ta.value.slice(ta.selectionEnd ?? ta.value.length);
      const isOnLastLine = !textAfterCursor.includes("\n");
      if (isOnLastLine && historyIndex >= 0) {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputMessage(messageHistory[newIndex]);
        } else {
          setHistoryIndex(-1);
          setInputMessage(tempInput);
        }
      }
    }
  };

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  /**
   * MOP-0008 Step 8 — Confirm a pending destructive tool call.
   *
   * Dispatches a follow-up sendMessage with `context.confirmAction` set,
   * which the chat-api edge function short-circuits to executeConfirmedTool
   * (bypassing the agent loop so the model can't drift the args). Appends
   * the result as a new AI message and clears the originating message's
   * pendingConfirmation so the buttons disappear.
   */
  const handleConfirmAction = async (
    messageId: string,
    pc: PendingConfirmation,
  ) => {
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (!conv) return;

    setConfirmingMessageId(messageId);
    // Optimistically clear the prompt so the buttons disappear immediately.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, pendingConfirmation: undefined }
                  : m,
              ),
            }
          : c,
      ),
    );

    try {
      const confirmInput: ConfirmActionInput = {
        tool: pc.tool,
        args: pc.args,
        idempotencyKey: pc.idempotencyKey,
      };

      const response = await sendMessageMutation.mutateAsync({
        message: "",
        sessionId: conv.sessionId,
        context: {
          sessionId: conv.sessionId,
          conversationId: conv.id,
          confirmAction: confirmInput,
        },
      });

      const responseRecipes = (response as any).recipes as
        | StructuredRecipe[]
        | undefined;
      const aiMessage: Message = {
        id: response.response.id,
        content: response.response.content,
        sender: "ai",
        timestamp: new Date(response.response.timestamp),
        recipe: response.recipe,
        recipes:
          responseRecipes && responseRecipes.length > 1
            ? responseRecipes
            : undefined,
        pendingConfirmation: (response as any).pendingConfirmation,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id
            ? {
                ...c,
                messages: [...c.messages, aiMessage],
                lastMessage: response.response.content,
              }
            : c,
        ),
      );
    } catch (err) {
      Logger.chat.error("confirmAction", err as Error, {
        messageId,
        tool: pc.tool,
      });
      toast.error("Sorry, that action failed. Please try again.");
    } finally {
      setConfirmingMessageId(null);
    }
  };

  /**
   * MOP-0008 Step 8 — Cancel a pending destructive tool call.
   * No backend call is needed because nothing was executed. Just dismiss
   * the prompt locally; the message itself remains as conversation history.
   */
  const handleCancelConfirmation = (messageId: string) => {
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (!conv) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, pendingConfirmation: undefined }
                  : m,
              ),
            }
          : c,
      ),
    );
  };

  const currentConversation = getCurrentConversation();

  return (
    <div className="relative flex h-full min-h-0">
      {/* Backdrop — mobile only, dismisses the overlay drawer */}
      {isMobile && !isSidebarCollapsed && (
        <div
          className="absolute inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}
      {/* Sidebar - Conversation History.
          Desktop: inline, resizable column pushed in the flex row.
          Mobile: fixed-width overlay drawer that floats above the chat
          instead of squeezing it down to a sliver. */}
      <div
        ref={sidebarRef}
        className={`bg-stone-100 dark:bg-white/[0.03] border-r border-stone-200/60 dark:border-white/[0.06] flex flex-col min-h-0 transition-all duration-200 ease-in-out ${
          isMobile
            ? `absolute inset-y-0 left-0 z-40 shadow-xl ${isSidebarCollapsed ? "-translate-x-full" : "translate-x-0"}`
            : `relative ${isSidebarCollapsed ? "overflow-hidden" : ""}`
        }`}
        style={{
          width: isMobile ? "min(85vw, 320px)" : isSidebarCollapsed ? "0px" : `${sidebarWidth}px`,
        }}
      >
        {/* Resize Handle — desktop only; mobile drawer has a fixed width */}
        {!isSidebarCollapsed && !isMobile && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/50 dark:hover:bg-primary-400/50 transition-colors z-10 group"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-primary-500/30 dark:group-hover:bg-primary-400/30" />
          </div>
        )}
        {/* Header with New Chat and Multi-select */}
        <div className="p-3 border-b border-stone-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] backdrop-blur-sm">
          <div className="flex gap-2">
            <Button
              onClick={() => {
                createNewConversation();
                if (isMobile) setIsSidebarCollapsed(true);
              }}
              variant="outline"
              size="icon"
              title="New Chat"
              className="h-8 w-8 flex-1 bg-transparent dark:bg-white/[0.04] border-stone-200 dark:border-white/[0.08] hover:text-stone-900 dark:hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>

            {conversations.length > 0 && (
              <>
                {!isMultiSelectMode ? (
                  <Button
                    onClick={() => setIsMultiSelectMode(true)}
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 flex-1 bg-transparent dark:bg-white/[0.04] border-stone-200 dark:border-white/[0.08] hover:text-stone-900 dark:hover:text-white"
                    title="Select"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={selectAllConversations}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-1 bg-transparent dark:bg-white/[0.04] border-stone-200 dark:border-white/[0.08] hover:text-stone-900 dark:hover:text-white"
                      title="Select All"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={clearSelection}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-1 bg-transparent dark:bg-white/[0.04] border-stone-200 dark:border-white/[0.08] hover:text-stone-900 dark:hover:text-white"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </>
            )}

            {isMultiSelectMode && selectedConversations.size > 0 && (
              <Button
                onClick={() => setShowBulkDeleteConfirm(true)}
                variant="destructive"
                size="icon"
                className="h-8 w-8 flex-1"
                title={`Delete Selected (${selectedConversations.size})`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations
            .filter((conv) => conv.messages.length > 0 || conv.isTemporary)
            .map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 border-b border-stone-200/40 dark:border-white/[0.04] cursor-pointer transition-colors group ${
                  currentConversationId === conversation.id
                    ? "bg-white dark:bg-white/[0.06] shadow-sm"
                    : ""
                } ${
                  selectedConversations.has(conversation.id)
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                    : ""
                }`}
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleConversationSelection(conversation.id);
                  } else {
                    // Clean up any temporary conversations with no messages when switching
                    setConversations((prev) =>
                      prev.filter((conv) => {
                        // Keep current conversation even if temporary with no messages
                        if (conv.id === conversation.id) return true;
                        // Remove temporary conversations with no messages
                        return !conv.isTemporary || conv.messages.length > 0;
                      })
                    );
                    setCurrentConversationId(conversation.id);
                    if (!isLocalTempConversationId(conversation.id)) {
                      void refreshConversationMessages(conversation.id);
                    }
                    if (isMobile) setIsSidebarCollapsed(true);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isMultiSelectMode ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleConversationSelection(conversation.id);
                        }}
                        className="flex-shrink-0"
                      >
                        {selectedConversations.has(conversation.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    ) : (
                      <MessageSquare className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate block">
                          {conversation.title}
                        </span>
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {conversation.lastMessage}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {conversation.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {!isMultiSelectMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConversationTarget({ id: conversation.id, title: conversation.title });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          {conversations.filter(
            (conv) => conv.messages.length > 0 || conv.isTemporary
          ).length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No conversations yet. Start a new chat to begin!
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        {/* Sidebar toggle */}
        <div className="flex items-center px-2.5 pt-2.5 pb-0">
          <Button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className={`flex-1 p-4 space-y-4 min-h-0 overflow-x-hidden ${
            currentConversation && currentConversation.messages.length > 0
              ? "overflow-y-auto"
              : "overflow-hidden"
          }`}
        >
          {!currentConversation || currentConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
              <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                Hey {getFirstName()}, what can I help you with?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                You can start typing, or use the buttons below for quick actions
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => handleIntentSelection("recipe_extraction")}
                  variant="outline"
                  className="px-6 py-2"
                >
                  Add new recipe
                </Button>
                <Button
                  onClick={() => handleIntentSelection(null)}
                  variant="outline"
                  className="px-6 py-2"
                >
                  Questions about recipes
                </Button>
              </div>
            </div>
          ) : (
            currentConversation.messages.map((message, msgIndex) => (
              <div
                key={message.id}
                className={`group/msg flex gap-3 ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                } ${(message.recipe || message.recipes) && message.sender === "ai" ? "w-full" : ""}`}
              >
                {message.sender === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                {/* Optimistic thinking placeholder — three animated dots */}
                {message.isThinking ? (
                  <div className="rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                ) : (message.recipe || message.recipes) && message.sender === "ai" ? (
                  // Full-width recipe display (single or multi)
                  <div className="flex-1">
                    {message.content && (
                      <div className="relative mb-3 max-w-[90%] sm:max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
                        <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                          {message.content}
                        </p>
                        <button
                          onClick={() => copyMessage(message.id, message.content)}
                          className="absolute -top-3 right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                          title="Copy message"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
                    {/* Render multiple recipe cards or single */}
                    {(() => {
                      const recipeList = message.recipes && message.recipes.length > 1 ? message.recipes : [message.recipe!];
                      const isMulti = recipeList.length > 1;
                      const cardRefs = isMulti ? recipeList.map(() => createRef<StructuredRecipeDisplayHandle>()) : [];
                      const prevUserMsg = currentConversation.messages.slice(0, msgIndex).reverse().find(m => m.sender === "user" && m.images?.length);
                      const userImage = prevUserMsg?.images?.[0];

                      return (
                        <>
                          {isMulti && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="mb-2 gap-1.5"
                              onClick={() => {
                                cardRefs.forEach((r) => r.current?.triggerSave());
                              }}
                            >
                              <Save className="h-3.5 w-3.5" />
                              Save All ({recipeList.length})
                            </Button>
                          )}
                          {recipeList.map((recipeItem, recipeIdx) => {
                            const draftKey =
                              currentConversationId
                                ? buildDraftRecipeKey(
                                    currentConversationId,
                                    message.id,
                                    recipeIdx
                                  )
                                : undefined;
                            return (
                            <StructuredRecipeDisplay
                              key={`${message.id}-recipe-${recipeIdx}`}
                              ref={isMulti ? cardRefs[recipeIdx] : undefined}
                              recipe={recipeItem}
                              conversationId={currentConversationId ?? undefined}
                              messageId={message.id}
                              recipeIndex={recipeIdx}
                              draftKey={draftKey}
                              userImageDataUrl={userImage}
                              previewImageDataUrl={message.previewImageDataUrl}
                              thumbnailUrl={message.thumbnailUrl}
                              onSave={(result) => {
                                if (!currentConversationId) return;
                                const now = new Date();

                                const saveRequestMsg: Message = {
                                  id: `save-req-${Date.now()}-${recipeIdx}`,
                                  content: "Save Recipe",
                                  sender: "user",
                                  timestamp: now,
                                };

                                const saveResponseMsg: Message = {
                                  id: `save-res-${Date.now()}-${recipeIdx}`,
                                  content: result.success
                                    ? `"${recipeItem.title}" has been saved to your recipe collection!`
                                    : `Failed to save recipe: ${result.error || "Unknown error"}`,
                                  sender: "ai",
                                  timestamp: new Date(now.getTime() + 1),
                                };

                                setConversations((prev) =>
                                  prev.map((conv) =>
                                    conv.id === currentConversationId
                                      ? {
                                          ...conv,
                                          messages: [...conv.messages, saveRequestMsg, saveResponseMsg],
                                          lastMessage: saveResponseMsg.content,
                                          timestamp: now,
                                        }
                                      : conv
                                  )
                                );

                                if (result.success) {
                                  toast.success(`"${recipeItem.title}" saved!`);
                                } else {
                                  toast.error(result.error || "Failed to save recipe");
                                }
                              }}
                            />
                            );
                          })}
                        </>
                      );
                    })()}
                    {message.pendingConfirmation && message.sender === "ai" && (
                      <ConfirmationPrompt
                        pendingConfirmation={message.pendingConfirmation}
                        isConfirming={confirmingMessageId === message.id}
                        onConfirm={() =>
                          handleConfirmAction(
                            message.id,
                            message.pendingConfirmation!,
                          )
                        }
                        onCancel={() => handleCancelConfirmation(message.id)}
                      />
                    )}
                  </div>
                ) : (
                  // Regular message display
                  <div className="relative group/bubble max-w-[90%] sm:max-w-[70%] min-w-0">
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.sender === "user"
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      {/* Display images as thumbnails — click to expand */}
                      {message.videoFileName && (
                        <div className="mb-2 flex items-center gap-2 rounded-md bg-white/15 px-2 py-1.5 text-xs">
                          <Film className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{message.videoFileName}</span>
                        </div>
                      )}
                      {message.images && message.images.length > 0 && (
                        <div className={`mb-2 flex flex-wrap gap-1.5 ${message.images.length === 1 ? "" : ""}`}>
                          {message.images.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              onClick={() => setLightboxImage(imgUrl)}
                              className="relative rounded-md overflow-hidden hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50"
                              title="Click to view full size"
                            >
                              <img
                                src={imgUrl}
                                alt={`Uploaded image ${idx + 1}`}
                                className="w-20 h-20 object-cover rounded-md"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      {message.content && (
                        <p
                          className={`text-sm whitespace-pre-wrap break-words ${
                            message.sender === "user"
                              ? "text-white"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {message.content}
                        </p>
                      )}
                      <p
                        className={`text-xs opacity-70 mt-1 ${
                          message.sender === "user"
                            ? "text-white"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {message.pendingConfirmation && message.sender === "ai" && (
                      <ConfirmationPrompt
                        pendingConfirmation={message.pendingConfirmation}
                        isConfirming={confirmingMessageId === message.id}
                        onConfirm={() =>
                          handleConfirmAction(
                            message.id,
                            message.pendingConfirmation!,
                          )
                        }
                        onCancel={() => handleCancelConfirmation(message.id)}
                      />
                    )}
                    <button
                      onClick={() => copyMessage(message.id, message.content)}
                      className={`absolute -top-3 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded bg-white/80 dark:bg-white/10 backdrop-blur-sm shadow-sm text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 ${
                        message.sender === "user" ? "right-1" : "right-1"
                      }`}
                      title="Copy message"
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                )}
                {message.sender === "user" && (
                  <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                    {user?.avatar_url && !avatarError ? (
                      <img
                        src={user.avatar_url}
                        alt="You"
                        className="w-8 h-8 rounded-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {loadingLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelGeneration}
                  >
                    Stop
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 flex-shrink-0">
          {/* MOP-0019 — Batch Import Panel (drawer above input) */}
          {showBatchPanel && (
            <div className="mb-3">
              <BatchImportPanel
                onDismiss={() => setShowBatchPanel(false)}
                onSaveComplete={(summary) => {
                  setShowBatchPanel(false);
                  // Echo a system-level confirmation into the chat conversation.
                  const conversationId = currentConversationId ?? `local-${Date.now()}`;
                  setConversations((prev) =>
                    prev.map((conv) =>
                      conv.id === conversationId
                        ? {
                            ...conv,
                            messages: [
                              ...conv.messages,
                              {
                                id: `batch-save-${Date.now()}`,
                                content: `✅ ${summary}`,
                                sender: "ai" as const,
                                timestamp: new Date(),
                              },
                            ],
                          }
                        : conv,
                    ),
                  );
                }}
              />
            </div>
          )}
          <div className="space-y-2">
              {/* Image Previews */}
              {pendingImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {pendingImages.map((file, index) => {
                    const imageUrl = imagePreviewUrls[index] || '';
                    if (!imageUrl) return null; // Don't render if URL not ready yet
                    return (
                      <div
                        key={index}
                        className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                      >
                        <img
                          src={imageUrl}
                          alt={`Preview ${index + 1}`}
                          className="w-20 h-20 object-cover"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {pendingVideo && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-2 text-sm">
                  <Film className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span className="truncate flex-1">{pendingVideo.name}</span>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove video"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Input and Buttons */}
              {hasQueuedMessage && (
                <p className="text-xs text-muted-foreground">
                  1 message queued — will send when the current response finishes
                </p>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={pendingImages.length >= 4}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="icon"
                  disabled={pendingImages.length >= 4}
                  title={
                    pendingImages.length >= 4
                      ? "Maximum 4 images allowed"
                      : "Upload images or a saved recipe video"
                  }
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                {/* MOP-0019 — Batch import button */}
                <Button
                  onClick={() => setShowBatchPanel((v) => !v)}
                  variant={showBatchPanel ? "secondary" : "outline"}
                  size="icon"
                  title="Batch import recipes from URLs"
                  data-testid="batch-import-toolbar-btn"
                >
                  <PackagePlus className="h-4 w-4" />
                </Button>
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  data-testid="chat-input"
                  data-conversation-id={currentConversationId ?? ''}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
                  }}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  placeholder={
                    isLoading
                      ? "Draft your next message, or press Enter to queue it..."
                      : currentConversation?.selectedIntent === "recipe_extraction"
                      ? "Paste or type your recipe here, or upload images..."
                      : currentConversation?.selectedIntent === null
                      ? "Ask me about your recipes..."
                      : "Type your message... (Shift+Enter for new line)"
                  }
                  rows={2}
                  className="flex-1 resize-y overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ minHeight: '60px', maxHeight: '300px' }}
                />
                {isLoading ? (
                  <Button
                    onClick={handleCancelGeneration}
                    variant="destructive"
                    size="icon"
                    title="Stop generation"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      !inputMessage.trim() &&
                      pendingImages.length === 0 &&
                      !pendingVideo
                    }
                    size="icon"
                    data-testid="send-message-btn"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
          </div>
        </div>
      </div>

      {/* Image lightbox overlay */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConversationTarget}
        title="Delete conversation?"
        description={`"${deleteConversationTarget?.title || "This conversation"}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete conversation"
        isConfirming={isDeletingConversation}
        onConfirm={() => deleteConversationTarget && deleteConversation(deleteConversationTarget.id)}
        onCancel={() => setDeleteConversationTarget(null)}
      />

      <ConfirmDialog
        open={showBulkDeleteConfirm}
        title="Delete selected conversations?"
        description={`${selectedConversations.size} conversation${selectedConversations.size === 1 ? "" : "s"} will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        isConfirming={isDeletingConversation}
        onConfirm={deleteSelectedConversations}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </div>
  );
};
