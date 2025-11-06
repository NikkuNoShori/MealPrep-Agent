import React, { useState, useRef, useEffect } from 'react'
import { useChatHistory, useSendMessage } from '../../services/api'
import {
  ragService,
  detectIntent,
  formatRecipeContext,
} from "../../services/ragService";
import { Card, CardContent } from "../ui/card";
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
  Search,
  BookOpen,
  Save,
  Check,
  Copy,
} from "lucide-react";
import { ChatHistoryResponse, ChatMessageResponse } from "../../types";
import { useCreateRecipe, apiClient } from "../../services/api";
import { ToastService } from "../../services/toast";
import { parseRecipeFromText, formatRecipeForStorage, ParsedRecipe } from "../../utils/recipeParser";
import { Logger } from "../../services/logger";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  recipe?: ParsedRecipe | null; // Optional parsed recipe data
  recipeStored?: boolean; // Track if recipe has been stored
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: string;
  timestamp: Date;
  sessionId: string; // Add sessionId for n8n context
  isTemporary: boolean; // Track if session is temporary (not yet persisted)
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ragAbortControllerRef = useRef<AbortController | null>(null);

  const { data: chatHistory } = useChatHistory(50) as {
    data: ChatHistoryResponse | undefined;
  };
  const sendMessageMutation = useSendMessage();
  const createRecipeMutation = useCreateRecipe();

  // Load conversations from localStorage on component mount
  useEffect(() => {
    const savedConversations = localStorage.getItem("chat-conversations");
    const savedCurrentId = localStorage.getItem("chat-current-conversation-id");
    const shouldCreateTemporary = localStorage.getItem(
      "chat-create-temporary-session"
    );

    console.log("Loading conversations from localStorage:", {
      savedConversations,
      savedCurrentId,
      shouldCreateTemporary,
    });

    // Clear the temporary session flag
    if (shouldCreateTemporary) {
      localStorage.removeItem("chat-create-temporary-session");
    }

    if (savedConversations) {
      try {
        const parsedConversations = JSON.parse(savedConversations);
        console.log("Parsed conversations:", parsedConversations);

        // Convert timestamp strings back to Date objects and ensure isTemporary is set
        // Also preserve recipe data if present
        const conversationsWithDates = parsedConversations.map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            recipe: msg.recipe || null, // Preserve recipe data if present
            recipeStored: msg.recipeStored || false, // Preserve stored status
          })),
          isTemporary: conv.isTemporary || false, // Ensure isTemporary is set
        }));
        setConversations(conversationsWithDates);

        if (shouldCreateTemporary) {
          // Create a new temporary session when requested from navbar
          createNewConversation();
        } else if (
          savedCurrentId &&
          conversationsWithDates.find(
            (c: Conversation) => c.id === savedCurrentId
          )
        ) {
          setCurrentConversationId(savedCurrentId);
        } else if (conversationsWithDates.length > 0) {
          setCurrentConversationId(conversationsWithDates[0].id);
        } else {
          createDefaultConversation();
        }
      } catch (error) {
        console.error("Error loading conversations from localStorage:", error);
        // Fallback to default conversation
        createDefaultConversation();
      }
    } else {
      console.log("No saved conversations found, creating default");
      createDefaultConversation();
    }
  }, []);

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
    };
    setConversations([defaultConversation]);
    setCurrentConversationId(defaultConversation.id);
  };

  // Save conversations to localStorage whenever they change (excluding temporary ones)
  useEffect(() => {
    if (conversations.length > 0) {
      // Only save non-temporary conversations to localStorage
      const persistentConversations = conversations.filter(
        (conv) => !conv.isTemporary
      );
      console.log(
        "Saving persistent conversations to localStorage:",
        persistentConversations
      );
      localStorage.setItem(
        "chat-conversations",
        JSON.stringify(persistentConversations)
      );
    }
  }, [conversations]);

  // Clean up temporary sessions on component unmount
  useEffect(() => {
    return () => {
      // Clean up any temporary sessions when component unmounts
      setConversations((prev) => prev.filter((conv) => !conv.isTemporary));
    };
  }, []);

  // Save current conversation ID to localStorage
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem(
        "chat-current-conversation-id",
        currentConversationId
      );
    }
  }, [currentConversationId]);

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
    const newSessionId = `session-${Date.now()}`;
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      lastMessage: "",
      timestamp: new Date(),
      sessionId: newSessionId,
      isTemporary: true, // Mark as temporary until first message
    };
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setInputMessage("");
  };

  const deleteConversation = (conversationId: string) => {
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
  };

  const deleteSelectedConversations = () => {
    const conversationsToDelete = Array.from(selectedConversations);
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

  // Clean up temporary sessions that haven't been used
  const cleanupTemporarySessions = () => {
    setConversations((prev) => prev.filter((conv) => !conv.isTemporary));
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

  const handleCancelMessage = () => {
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (ragAbortControllerRef.current) {
      ragAbortControllerRef.current.abort();
      ragAbortControllerRef.current = null;
    }
    
    // Reset loading state immediately
    setIsLoading(false);
    
    // Remove the "Thinking..." indicator by removing the last pending message
    // The user message is already added, so we just need to reset state
    ToastService.info("Request cancelled");
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentConversationId) return;

    const currentConversation = getCurrentConversation();
    if (!currentConversation) return;

    // Create abort controllers for this request
    abortControllerRef.current = new AbortController();
    ragAbortControllerRef.current = new AbortController();

    // Detect intent
    const intent = detectIntent(inputMessage);
    console.log("Detected intent:", intent);

    // Save the message text before clearing input
    const messageText = inputMessage;

    // Add message to history
    setMessageHistory((prev) => [
      messageText,
      ...prev.filter((msg) => msg !== messageText),
    ]);
    setHistoryIndex(-1);
    setTempInput("");

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    // Update conversation with user message and persist if temporary
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              lastMessage: messageText,
              timestamp: new Date(),
              title:
                conv.messages.length === 0
                  ? messageText.slice(0, 30) + "..."
                  : conv.title,
              isTemporary: false, // Persist the session when first message is sent
            }
          : conv
      )
    );

    setInputMessage("");
    setIsLoading(true);

    try {
      let response: ChatMessageResponse;

      if (intent === "recipe_extraction") {
        // Handle recipe extraction - use direct API call with abort signal
        response = (await apiClient.sendMessage({
          message: messageText,
          sessionId: currentConversation.sessionId,
          intent: "recipe_extraction",
          context: {
            recentMessages: currentConversation.messages.slice(-5),
          },
        }, abortControllerRef.current.signal)) as ChatMessageResponse;
      } else {
        // Handle RAG-based queries
        let recipeContext = "";

        // Only run RAG search for queries that explicitly need recipe context
        // Skip RAG for general_chat to improve response times
        if (
          intent === "recipe_search" ||
          intent === "ingredient_search" ||
          intent === "cooking_advice"
        ) {
          try {
            // Check if request was aborted before starting RAG search
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error("Request aborted");
            }

            // Run RAG search with timeout and abort support
            const ragPromise = ragService.searchRecipes({
              query: messageText,
              userId: "test-user", // TODO: Get actual user ID
              limit: 5,
              searchType: "hybrid",
            });

            // Set a timeout for RAG search (5 seconds max)
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("RAG search timeout")), 5000)
            );

            // Race between RAG search, timeout, and abort signal
            const ragResults = await Promise.race([
              ragPromise,
              timeoutPromise,
              new Promise((_, reject) => {
                if (ragAbortControllerRef.current) {
                  ragAbortControllerRef.current.signal.addEventListener('abort', () => {
                    reject(new Error("RAG search aborted"));
                  });
                }
              })
            ]) as any;
            
            recipeContext = formatRecipeContext(ragResults.results);
          } catch (ragError: any) {
            // Don't show error if it was aborted - that's expected
            if (ragError.message !== "RAG search aborted" && ragError.message !== "Request aborted") {
              console.warn(
                "RAG search failed or timed out, proceeding without context:",
                ragError
              );
            }
            // Continue without RAG context - AI can still respond
          }
        }

        // Check if request was aborted before sending to API
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error("Request aborted");
        }

        // Use direct API call with abort signal
        response = (await apiClient.sendMessage({
          message: messageText,
          sessionId: currentConversation.sessionId,
          intent: intent,
          context: {
            recentMessages: currentConversation.messages.slice(-5),
            recipeContext: recipeContext,
          },
        }, abortControllerRef.current.signal)) as ChatMessageResponse;
      }

      // Check if request was aborted after receiving response
      if (abortControllerRef.current?.signal.aborted) {
        return; // Don't process the response if it was cancelled
      }

      // Try to parse recipe from AI response
      const parsedRecipe = parseRecipeFromText(response.response.content);
      
      const aiMessage: Message = {
        id: response.response.id,
        content: response.response.content,
        sender: "ai",
        timestamp: new Date(response.response.timestamp),
        recipe: parsedRecipe || null,
        recipeStored: false,
      };

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
    } catch (error: any) {
      // Don't show error message if request was aborted - that's expected
      if (error.message === "Request aborted" || error.name === "AbortError") {
        console.log("Request was cancelled by user");
        return;
      }
      
      console.error("Failed to send message:", error);
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
      // Clean up abort controllers
      abortControllerRef.current = null;
      ragAbortControllerRef.current = null;
    }
  };

  const handleStoreRecipe = async (messageId: string, recipe: ParsedRecipe) => {
    try {
      Logger.info('🔵 ChatInterface: Storing recipe from chat', { messageId, recipeTitle: recipe.title });
      
      const recipeData = formatRecipeForStorage(recipe);
      
      await createRecipeMutation.mutateAsync(recipeData);
      
      // Update message to mark recipe as stored
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          messages: conv.messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, recipeStored: true }
              : msg
          ),
        }))
      );
      
      ToastService.success(`Recipe "${recipe.title}" saved successfully!`);
      Logger.info('✅ ChatInterface: Recipe stored successfully', { messageId, recipeTitle: recipe.title });
    } catch (error: any) {
      Logger.error('🔴 ChatInterface: Failed to store recipe', error);
      ToastService.error(`Failed to save recipe: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle arrow key navigation through message history
    // History is stored with newest messages at index 0
    // ArrowUp goes to older messages (higher indices), ArrowDown goes to newer messages (lower indices)
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (messageHistory.length === 0) return;
      
      // Save current input if we're starting navigation
      if (historyIndex === -1 && inputMessage.trim()) {
        setTempInput(inputMessage);
      }
      
      // Navigate to older message (higher index)
      if (historyIndex < messageHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputMessage(messageHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      
      // Navigate to newer message (lower index) or back to original input
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputMessage(messageHistory[newIndex]);
      } else if (historyIndex === 0) {
        // Return to original input
        setHistoryIndex(-1);
        setInputMessage(tempInput);
      }
    }
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      ToastService.success('Message copied to clipboard!');
    } catch (error) {
      Logger.error('Failed to copy message:', error);
      ToastService.error('Failed to copy message');
    }
  };

  const currentConversation = getCurrentConversation();

  return (
    <div className="flex h-full min-h-0 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Sidebar - Conversation History */}
      <div className="w-80 bg-gray-50/90 dark:bg-gray-800/90 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0 shadow-lg">
        {/* Header with New Chat and Multi-select */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-2">
          <Button
            onClick={createNewConversation}
            className="w-full justify-start"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>

          {conversations.length > 0 && (
            <div className="flex gap-2">
              {!isMultiSelectMode ? (
                <Button
                  onClick={() => setIsMultiSelectMode(true)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select
                </Button>
              ) : (
                <>
                  <Button
                    onClick={selectAllConversations}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Select All
                  </Button>
                  <Button
                    onClick={clearSelection}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}

          {isMultiSelectMode && selectedConversations.size > 0 && (
            <Button
              onClick={deleteSelectedConversations}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedConversations.size})
            </Button>
          )}

          {conversations.some((conv) => conv.isTemporary) && (
            <Button
              onClick={cleanupTemporarySessions}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Clean Up Unused Chats
            </Button>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden chat-container">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 border-b border-gray-100/50 dark:border-gray-700/50 cursor-pointer transition-all duration-200 group ${
                currentConversationId === conversation.id
                  ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 dark:from-primary/20 dark:to-primary/10 dark:border-primary/40 shadow-sm"
                  : "hover:bg-gray-100/80 dark:hover:bg-gray-700/80"
              } ${
                selectedConversations.has(conversation.id)
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                  : ""
              }`}
              onClick={() => {
                if (isMultiSelectMode) {
                  toggleConversationSelection(conversation.id);
                } else {
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
                      {conversation.isTemporary && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                          Temporary
                        </span>
                      )}
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
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-xl bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 min-h-0 chat-container">
              {!currentConversation ||
              currentConversation.messages.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-lg border border-primary/20">
                    <Bot className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-2">
                    Welcome to MealPrep Assistant!
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Ask me anything about recipes, meal planning, or cooking tips.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl shadow-sm border border-blue-200/50 dark:border-blue-700/30 hover:shadow-md transition-shadow">
                      <BookOpen className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        "Add this recipe to my collection"
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/20 rounded-xl shadow-sm border border-green-200/50 dark:border-green-700/30 hover:shadow-md transition-shadow">
                      <Search className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                      <p className="text-xs font-medium text-green-700 dark:text-green-300">
                        "Find recipes with chicken"
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                currentConversation.messages.map((message, index) => {
                  // Subtle stagger for visual variety (much smaller offset)
                  const staggerOffset = (index % 3) * 4;
                  
                  return (
                  <div
                    key={message.id}
                    className={`flex gap-3 group transition-all duration-300 ${
                      message.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                    style={{
                      transform: message.sender === "user" 
                        ? `translateX(-${staggerOffset}px)` 
                        : `translateX(${staggerOffset}px)`,
                      maxWidth: '100%',
                    }}
                  >
                    {message.sender === "ai" && (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 shadow-md border border-primary/20">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 relative max-w-full">
                      <div
                        className={`${
                          message.sender === "user"
                            ? "max-w-[75%] min-w-[200px] w-fit"
                            : "max-w-[75%] min-w-[250px]"
                        } rounded-2xl px-5 py-3 relative transition-all duration-200 hover:shadow-lg ${
                          message.sender === "user"
                            ? "bg-gradient-to-br from-primary to-primary/90 text-white shadow-md"
                            : "bg-gray-300 dark:bg-gray-700 border border-gray-400 dark:border-gray-600 shadow-sm text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {/* Copy button - appears on hover */}
                        <button
                          onClick={() => handleCopyMessage(message.content)}
                          className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 ${
                            message.sender === "user"
                              ? "text-white/80 hover:text-white"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                          }`}
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        
                        <p
                          className={`text-sm whitespace-pre-wrap pr-8 ${
                            message.sender === "user"
                              ? "text-white"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {message.content}
                        </p>
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
                      
                      {/* Show "Store Recipe" button if recipe is detected and not yet stored */}
                      {message.sender === "ai" && message.recipe && !message.recipeStored && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleStoreRecipe(message.id, message.recipe!)}
                            disabled={createRecipeMutation.isPending}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            {createRecipeMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-3 w-3 mr-1" />
                                Store Recipe
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {message.recipe.title}
                          </span>
                        </div>
                      )}
                      
                      {/* Show success indicator if recipe was stored */}
                      {message.sender === "ai" && message.recipe && message.recipeStored && (
                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          <span>Recipe "{message.recipe.title}" saved</span>
                        </div>
                      )}
                    </div>
                    {message.sender === "user" && (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center flex-shrink-0 shadow-md">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  );
                })
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
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm p-4 flex-shrink-0 shadow-lg">
              <div className="flex gap-3 items-end">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (↑/↓ to navigate history)"
                  className="flex-1 rounded-2xl border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary/50 shadow-sm bg-gray-100 dark:bg-gray-800"
                />
                <Button
                  onClick={isLoading ? handleCancelMessage : handleSendMessage}
                  disabled={!isLoading && !inputMessage.trim()}
                  size="icon"
                  className={`rounded-2xl h-10 w-10 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 ${
                    isLoading 
                      ? "bg-red-500 hover:bg-red-600 text-white" 
                      : ""
                  }`}
                  variant={isLoading ? "destructive" : "default"}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 bg-white rounded-sm" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

