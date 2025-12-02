import React, { useState, useRef, useEffect } from 'react'
import { useSendMessage, useChatHistory } from "../../services/api";
import { apiClient } from "../../services/api";
import { detectIntent } from "../../services/ragService";
import { Logger } from "../../services/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
} from "lucide-react";
import { ChatMessageResponse, StructuredRecipe } from "../../types";
import { useAuthStore } from "../../stores/authStore";
import { StructuredRecipeDisplay } from "./StructuredRecipeDisplay";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  images?: string[]; // Array of image URLs or base64 data URLs
  recipe?: StructuredRecipe; // Optional structured recipe data
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
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");
  const [selectedConversations, setSelectedConversations] = useState<
    Set<string>
  >(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]); // Images to be sent with next message
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]); // Object URLs for image previews
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // Load saved width from localStorage or default to 320px (w-80)
    const saved = localStorage.getItem("chat-sidebar-width");
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = useSendMessage();
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
                  messages = messagesResponse.messages.map((msg: any) => ({
                    id: msg.id,
                    content: msg.content,
                    sender: msg.sender as "user" | "ai",
                    timestamp: new Date(msg.timestamp),
                  }));
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

          setConversations(conversationsWithMessages);

          // Set the most recent conversation as current
          if (conversationsWithMessages.length > 0) {
            const firstConv = conversationsWithMessages[0];
            setCurrentConversationId(firstConv.id);
            Logger.chat.conversationLoaded(firstConv.id, firstConv.messages.length);
          } else {
            createDefaultConversation();
          }
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getCurrentConversation = () => {
    return conversations.find((conv) => conv.id === currentConversationId);
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
      return;
    }

    // If it's in the database (has messages), delete it via API
    try {
      await apiClient.deleteConversation(conversationId);
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
      // Revert state change on error
      refetchHistory();
    }
  };

  const deleteSelectedConversations = async () => {
    const conversationsToDelete = Array.from(selectedConversations);

    // Delete each conversation from the database
    const deletePromises = conversationsToDelete.map(async (conversationId) => {
      const conversation = conversations.find(
        (conv) => conv.id === conversationId
      );

      // Only call API for non-temporary conversations with messages
      if (
        conversation &&
        !(conversation.isTemporary && conversation.messages.length === 0)
      ) {
        try {
          await apiClient.deleteConversation(conversationId);
        } catch (error) {
          console.error(
            `Error deleting conversation ${conversationId}:`,
            error
          );
        }
      }
    });

    await Promise.all(deletePromises);

    // Remove from state after successful API calls
    setConversations((prev) =>
      prev.filter((conv) => !selectedConversations.has(conv.id))
    );

    // If current conversation is being deleted, switch to another one
    if (
      currentConversationId &&
      selectedConversations.has(currentConversationId)
    ) {
      const remainingConversations = conversations.filter(
        (conv) => !selectedConversations.has(conv.id)
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

    // Refetch to sync with database
    refetchHistory();
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

  // Check if current conversation is temporary and unused
  const isCurrentConversationTemporary = () => {
    const current = getCurrentConversation();
    return current?.isTemporary && current.messages.length === 0;
  };

  const updateConversationTitle = (conversationId: string, title: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? { ...conv, title: title || "New Chat" }
          : conv
      )
    );
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    // Limit to 4 images total
    const remainingSlots = 4 - pendingImages.length;
    const filesToAdd = imageFiles.slice(0, remainingSlots);

    setPendingImages((prev) => [...prev, ...filesToAdd]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle paste images from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));

    if (imageItems.length > 0 && pendingImages.length < 4) {
      const remainingSlots = 4 - pendingImages.length;
      const itemsToProcess = imageItems.slice(0, remainingSlots);

      itemsToProcess.forEach((item) => {
        const file = item.getAsFile();
        if (file) {
          setPendingImages((prev) => [...prev, file]);
        }
      });
    }
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

  // Create object URLs when pendingImages change
  useEffect(() => {
    // Revoke old URLs
    imagePreviewUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    
    // Create new URLs for current images
    const newUrls = pendingImages.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls(newUrls);
    
    // Cleanup function to revoke URLs on unmount or when images change
    return () => {
      newUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [pendingImages]); // Only recreate when pendingImages changes

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem("chat-sidebar-width", sidebarWidth.toString());
  }, [sidebarWidth]);

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
    // Allow sending if there's text OR images
    if (
      (!inputMessage.trim() && pendingImages.length === 0) ||
      isLoading ||
      !currentConversationId
    )
      return;

    const currentConversation = getCurrentConversation();
    if (!currentConversation) {
      Logger.chat.error('sendMessage', new Error('No current conversation'), { currentConversationId });
      return;
    }

    // Use manually selected intent (or null for RAG queries)
    const intent = currentConversation.selectedIntent || null;
    Logger.chat.stateChange('message_sending', {
      conversationId: currentConversationId,
      intent,
      hasImages: pendingImages.length > 0,
      messageLength: inputMessage.length,
    });

    // Add message to history
    setMessageHistory((prev) => [
      inputMessage,
      ...prev.filter((msg) => msg !== inputMessage),
    ]);
    setHistoryIndex(-1);
    setTempInput("");

    // Convert images to data URLs
    const imageDataUrls = await Promise.all(
      pendingImages.map((file) => fileToDataURL(file))
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
      images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
    };

    // Update conversation with user message and persist if temporary
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              lastMessage: inputMessage,
              timestamp: new Date(),
              title:
                conv.messages.length === 0
                  ? (() => {
                      const trimmedMessage = inputMessage.trim();
                      if (trimmedMessage) {
                        return trimmedMessage.slice(0, 30) + (trimmedMessage.length > 30 ? "..." : "");
                      } else if (pendingImages.length > 0) {
                        return `${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''}`;
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
    // Revoke all image preview URLs before clearing
    imagePreviewUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    setImagePreviewUrls([]);
    setPendingImages([]); // Clear images after adding to message
    setIsLoading(true);

    try {
      let response: ChatMessageResponse;

      if (intent === "recipe_extraction") {
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
        } = {
          message: inputMessage,
          sessionId: currentConversation.sessionId,
          intent: "recipe_extraction",
          context: {
            recentMessages: currentConversation.messages.slice(-5),
            conversationId: currentConversationId,
          },
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
        // Handle general chat and RAG queries
        // Server performs AI-powered intent detection, but we can provide a client-side hint
        const detectedIntent = detectIntent(inputMessage);
        Logger.chat.intentDetected(detectedIntent, 0.8, 'Client-side hint (server will make final decision)', inputMessage);

        // Only send explicit intent if client-side detection strongly suggests recipe_extraction
        // Otherwise, let server's AI-powered detection decide (it handles images, context, etc.)
        // Server intents: 'recipe_extraction' | 'rag_search' | 'general_chat'
        const intentToSend =
          detectedIntent === "recipe_extraction"
            ? "recipe_extraction" // Explicitly request recipe extraction
            : undefined; // Let server's AI detection decide (handles RAG search, general chat, etc.)

        const messageData: {
          message: string;
          sessionId: string;
          intent?: string;
          images?: string[];
          context: any;
        } = {
          message: inputMessage,
          sessionId: currentConversation.sessionId,
          intent: intentToSend, // Only set if recipe_extraction, otherwise undefined for server to detect
          context: {
            recentMessages: currentConversation.messages.slice(-5),
            conversationId: currentConversationId,
            clientDetectedIntent: detectedIntent, // Pass as hint for logging/debugging
          },
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
      }

      const aiMessage: Message = {
        id: response.response.id,
        content: response.response.content,
        sender: "ai",
        timestamp: new Date(response.response.timestamp),
        recipe: response.recipe, // Include structured recipe if present
      };

      // Log successful response
      if (response.recipe) {
        Logger.chat.recipeExtracted(
          currentConversationId,
          response.recipe.title || 'Unknown',
          true
        );
      }

      // Update conversation with AI response
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

      Logger.chat.stateChange('message_received', {
        conversationId: currentConversationId,
        hasRecipe: !!response.recipe,
      });
    } catch (error) {
      Logger.chat.error('sendMessage', error as Error, {
        conversationId: currentConversationId,
        sessionId: currentConversation?.sessionId,
        messageLength: inputMessage.length,
        imageCount: pendingImages.length,
      });
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "Sorry, I encountered an error. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [...conv.messages, errorMessage],
                lastMessage: "Error occurred",
              }
            : conv
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < messageHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        if (newIndex === 0) {
          setTempInput(inputMessage);
        }
        setInputMessage(messageHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputMessage(messageHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputMessage(tempInput);
      }
    }
  };

  const currentConversation = getCurrentConversation();

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Sidebar - Conversation History */}
      <div
        ref={sidebarRef}
        className="bg-gray-600 dark:bg-slate-800 border-r border-primary-200/50 dark:border-slate-700/50 flex flex-col min-h-0 relative"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/50 dark:hover:bg-primary-400/50 transition-colors z-10 group"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-primary-500/30 dark:group-hover:bg-primary-400/30" />
        </div>
        {/* Header with New Chat and Multi-select */}
        <div className="p-3 border-b border-primary-200/50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 backdrop-blur-sm">
          <div className="flex gap-2">
            <Button
              onClick={createNewConversation}
              variant="outline"
              size="icon"
              title="New Chat"
              className="h-8 w-8 flex-1 bg-transparent dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600"
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
                    className="h-8 w-8 flex-1 bg-transparent dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600"
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
                      className="h-8 w-8 flex-1 bg-transparent dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600"
                      title="Select All"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={clearSelection}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-1 bg-transparent dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 border-gray-200 dark:border-slate-600"
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
                onClick={deleteSelectedConversations}
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
                className={`p-3 border-b border-primary-100/50 dark:border-slate-700/50 cursor-pointer hover:bg-primary-100/50 dark:hover:bg-slate-700/60 transition-colors group ${
                  currentConversationId === conversation.id
                    ? "bg-gradient-to-r from-primary-100/80 to-secondary-100/80 dark:bg-slate-700/70 dark:border-slate-600/50 shadow-sm"
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
                        deleteConversation(conversation.id);
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
      <div className="flex-1 flex flex-col min-h-0 bg-background p-2.5">
        {/* Messages Area */}
        <div
          className={`flex-1 p-4 space-y-4 min-h-0 overflow-y-auto chat-container`}
        >
          {!currentConversation || currentConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8">
              <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                Hey {getFirstName()}, what can I help you with?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                You can start typing, or use the buttons below for quick actions
              </p>
              <div className="flex gap-3">
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
            currentConversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                } ${message.recipe && message.sender === "ai" ? "w-full" : ""}`}
              >
                {message.sender === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                {message.recipe && message.sender === "ai" ? (
                  // Full-width recipe display
                  <div className="flex-1">
                    {message.content && (
                      <div className="mb-3 max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
                        <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                          {message.content}
                        </p>
                      </div>
                    )}
                    <StructuredRecipeDisplay
                      recipe={message.recipe}
                      onSave={() => {
                        // Recipe saved
                      }}
                    />
                  </div>
                ) : (
                  // Regular message display
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.sender === "user"
                        ? "bg-primary text-white"
                        : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    {/* Display images if present */}
                    {message.images && message.images.length > 0 && (
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        {message.images.map((imageUrl, idx) => (
                          <img
                            key={idx}
                            src={imageUrl}
                            alt={`Uploaded image ${idx + 1}`}
                            className="rounded-lg max-w-full h-auto object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {message.content && (
                      <p
                        className={`text-sm whitespace-pre-wrap ${
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
                )}
                {message.sender === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
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
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 flex-shrink-0">
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

              {/* Input and Buttons */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={
                    isLoading ||
                    pendingImages.length >= 4
                  }
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="icon"
                  disabled={
                    isLoading ||
                    pendingImages.length >= 4
                  }
                  title={
                    pendingImages.length >= 4
                      ? "Maximum 4 images allowed"
                      : "Upload images"
                  }
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  placeholder={
                    currentConversation?.selectedIntent === "recipe_extraction"
                      ? "Paste or type your recipe here, or upload images..."
                      : currentConversation?.selectedIntent === null
                      ? "Ask me about your recipes..."
                      : "Type your message or question..."
                  }
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    (!inputMessage.trim() && pendingImages.length === 0) ||
                    isLoading
                  }
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
