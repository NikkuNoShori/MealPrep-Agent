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
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { ChatHistoryResponse, ChatMessageResponse } from "../../types";
import { useCreateRecipe, useUpdateRecipe, apiClient } from "../../services/api";
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
  feedback?: "thumbsUp" | "thumbsDown" | null; // User feedback on AI messages
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
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "thumbsUp" | "thumbsDown">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ragAbortControllerRef = useRef<AbortController | null>(null);

  const { data: chatHistory } = useChatHistory(50) as {
    data: ChatHistoryResponse | undefined;
  };
  const sendMessageMutation = useSendMessage();
  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();

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
            feedback: msg.feedback || null, // Preserve feedback if present
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

  // Update message history when conversation changes
  useEffect(() => {
    const currentConversation = getCurrentConversation();
    if (currentConversation && currentConversation.messages.length > 0) {
      // Extract all user messages from current conversation and populate history
      const userMessages = currentConversation.messages
        .filter((msg) => msg.sender === "user")
        .map((msg) => msg.content)
        .reverse(); // Reverse to have newest first (index 0 = most recent)
      
      if (userMessages.length > 0) {
        setMessageHistory(userMessages);
        setHistoryIndex(-1);
        setTempInput("");
      }
    }
  }, [currentConversationId, conversations]);

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

    // Detect intent - check current message and recent conversation context
    let intent = detectIntent(inputMessage);
    
    // If intent is general_chat but message contains "save", check recent messages for recipe context
    if (intent === 'general_chat' && inputMessage.toLowerCase().includes('save')) {
      const recentMessages = currentConversation.messages.slice(-3);
      const hasRecipeContext = recentMessages.some(msg => 
        msg.sender === 'user' && 
        (msg.content.toLowerCase().includes('recipe') || 
         msg.content.toLowerCase().includes('ingredient') ||
         msg.content.toLowerCase().includes('cook') ||
         msg.content.toLowerCase().includes('bake'))
      );
      if (hasRecipeContext) {
        intent = 'recipe_extraction';
        console.log("Detected recipe_extraction from conversation context");
      }
    }
    
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

      // Check if response contains an error (from 503 or other error responses)
      if ((response as any).error) {
        const errorMessage = (response as any).message || (response as any).error || 'AI service unavailable';
        Logger.error('🔴 ChatInterface: Error response from server', { 
          error: (response as any).error,
          message: errorMessage,
          details: (response as any).details
        });
        throw new Error(errorMessage);
      }

      // Validate response structure - check for expected ChatMessageResponse format
      if (!response || typeof response !== 'object') {
        Logger.error('🔴 ChatInterface: Invalid response type from server', { response });
        throw new Error('Invalid response format from server');
      }

      // Check if response has the expected structure
      if (!response.response || !response.response.content) {
        Logger.error('🔴 ChatInterface: Invalid response structure from server', { 
          response,
          hasResponse: !!response.response,
          hasContent: !!(response.response && response.response.content)
        });
        throw new Error('Invalid response format from server - missing response.content');
      }

      // Extract recipe from response - check for structured recipe first (from n8n)
      let parsedRecipe: ParsedRecipe | null = null;
      
      // Check if response has a recipe field (from n8n recipe extraction)
      if ((response as any).recipe) {
        parsedRecipe = (response as any).recipe as ParsedRecipe;
        Logger.info('🔵 ChatInterface: Found structured recipe in response', { recipeTitle: parsedRecipe.title });
      } else if ((response as any).response?.recipe) {
        // Check nested response.recipe
        parsedRecipe = (response as any).response.recipe as ParsedRecipe;
        Logger.info('🔵 ChatInterface: Found structured recipe in nested response', { recipeTitle: parsedRecipe.title });
      } else {
        // Fall back to parsing from text content
        parsedRecipe = parseRecipeFromText(response.response.content);
        if (parsedRecipe) {
          Logger.info('🔵 ChatInterface: Parsed recipe from text content', { recipeTitle: parsedRecipe.title });
        }
      }
      
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
      
      Logger.error("🔴 ChatInterface: Failed to send message", {
        error: error.message,
        status: (error as any).status,
        statusText: (error as any).statusText,
        details: (error as any).details
      });
      
      // Extract error message from error object
      let errorContent = "Sorry, I encountered an error. Please try again.";
      
      // Priority: error.message > error.details.message > error.details.error > default
      if (error.message) {
        errorContent = error.message;
      } else if ((error as any).details?.message) {
        errorContent = (error as any).details.message;
      } else if ((error as any).details?.error) {
        errorContent = (error as any).details.error;
      } else if ((error as any).response?.data?.message) {
        errorContent = (error as any).response.data.message;
      } else if ((error as any).response?.data?.error) {
        errorContent = (error as any).response.data.error;
      }
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: errorContent,
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

  const [duplicateWarning, setDuplicateWarning] = useState<{
    messageId: string;
    recipe: ParsedRecipe;
    existingRecipe: any;
    allSimilar: any[];
  } | null>(null);

  const handleStoreRecipe = async (messageId: string, recipe: ParsedRecipe, forceSave: boolean = false) => {
    try {
      Logger.info('🔵 ChatInterface: Storing recipe from chat', { messageId, recipeTitle: recipe.title, forceSave });
      
      const recipeData = formatRecipeForStorage(recipe);
      
      const result = await createRecipeMutation.mutateAsync({ data: recipeData, forceSave });
      
      // Check if duplicate was found
      if (result && typeof result === 'object' && 'isDuplicate' in result && result.isDuplicate) {
        // Show duplicate warning dialog
        setDuplicateWarning({
          messageId,
          recipe,
          existingRecipe: result.existingRecipe,
          allSimilar: result.allSimilar || []
        });
        return;
      }
      
      // Recipe saved successfully
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

  const handleForceSave = async () => {
    if (!duplicateWarning) return;
    
    const { messageId, recipe } = duplicateWarning;
    setDuplicateWarning(null);
    await handleStoreRecipe(messageId, recipe, true); // Force save
  };

  const handleUpdateExisting = async () => {
    if (!duplicateWarning) return;
    
    const { messageId, recipe, existingRecipe } = duplicateWarning;
    
    try {
      Logger.info('🔵 ChatInterface: Updating existing recipe', { 
        messageId, 
        recipeTitle: recipe.title, 
        existingRecipeId: existingRecipe.id 
      });
      
      const recipeData = formatRecipeForStorage(recipe);
      
      const updatedRecipe = await updateRecipeMutation.mutateAsync({ 
        id: existingRecipe.id, 
        data: recipeData 
      });
      
      // Update the message to show recipe was updated
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
      
      setDuplicateWarning(null);
      ToastService.success(`Recipe "${recipe.title}" updated successfully!`);
      Logger.info('✅ ChatInterface: Recipe updated successfully', { 
        messageId, 
        recipeTitle: recipe.title,
        recipeId: existingRecipe.id 
      });
    } catch (error: any) {
      Logger.error('🔴 ChatInterface: Failed to update recipe', error);
      ToastService.error(`Failed to update recipe: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleCancelDuplicate = () => {
    setDuplicateWarning(null);
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

  const handleMessageFeedback = async (messageId: string, feedback: "thumbsUp" | "thumbsDown") => {
    const currentConversation = getCurrentConversation();
    if (!currentConversation) return;

    const message = currentConversation.messages.find((msg) => msg.id === messageId);
    if (!message || message.sender !== "ai") return;

    // Toggle: if clicking the same feedback, remove it; otherwise set it
    const newFeedback = message.feedback === feedback ? null : feedback;

    // Update local state immediately
    setConversations((prev) =>
      prev.map((conv) => ({
        ...conv,
        messages: conv.messages.map((msg) => {
          if (msg.id === messageId) {
            return { ...msg, feedback: newFeedback };
          }
          return msg;
        }),
      }))
    );

    // Send feedback to backend for analytics/improvement
    try {
      await apiClient.sendFeedback({
        messageId,
        conversationId: currentConversationId,
        sessionId: currentConversation.sessionId,
        feedback: newFeedback,
        messageContent: message.content,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Don't show error to user - feedback is optional
      Logger.warn('Failed to send feedback to backend:', error);
    }
  };

  // Filter conversations based on feedback and search query
  const filteredConversations = conversations.filter((conv) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = conv.title.toLowerCase().includes(query);
      const matchesLastMessage = conv.lastMessage.toLowerCase().includes(query);
      const matchesMessages = conv.messages.some((msg) =>
        msg.content.toLowerCase().includes(query)
      );
      if (!matchesTitle && !matchesLastMessage && !matchesMessages) {
        return false;
      }
    }

    // Feedback filter
    if (feedbackFilter !== "all") {
      const hasFeedback = conv.messages.some(
        (msg) => msg.sender === "ai" && msg.feedback === feedbackFilter
      );
      if (!hasFeedback) {
        return false;
      }
    }

    return true;
  });

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

          {/* Search and Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1">
              <Button
                onClick={() => setFeedbackFilter("all")}
                variant={feedbackFilter === "all" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
              >
                All
              </Button>
              <Button
                onClick={() => setFeedbackFilter("thumbsUp")}
                variant={feedbackFilter === "thumbsUp" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Up
              </Button>
              <Button
                onClick={() => setFeedbackFilter("thumbsDown")}
                variant={feedbackFilter === "thumbsDown" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Down
              </Button>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden chat-container">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {searchQuery || feedbackFilter !== "all"
                ? "No conversations match your filters"
                : "No conversations yet"}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
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
          )))}
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
                      
                      {/* Feedback buttons for AI messages */}
                      {message.sender === "ai" && (
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleMessageFeedback(message.id, "thumbsUp")}
                            className={`p-1.5 rounded-md transition-colors ${
                              message.feedback === "thumbsUp"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                            title="Thumbs up"
                            aria-label="Thumbs up"
                          >
                            <ThumbsUp className={`h-3.5 w-3.5 ${message.feedback === "thumbsUp" ? "fill-current" : ""}`} />
                          </button>
                          <button
                            onClick={() => handleMessageFeedback(message.id, "thumbsDown")}
                            className={`p-1.5 rounded-md transition-colors ${
                              message.feedback === "thumbsDown"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                            title="Thumbs down"
                            aria-label="Thumbs down"
                          >
                            <ThumbsDown className={`h-3.5 w-3.5 ${message.feedback === "thumbsDown" ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      )}

                      {/* Show "Save Recipe" button if recipe is detected and not yet stored */}
                      {message.sender === "ai" && message.recipe && !message.recipeStored && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <Button
                            onClick={() => handleStoreRecipe(message.id, message.recipe!)}
                            disabled={createRecipeMutation.isPending}
                            size="sm"
                            variant="default"
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {createRecipeMutation.isPending ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-3 w-3 mr-1" />
                                Save Recipe
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                            {message.recipe.title}
                          </span>
                        </div>
                      )}
                      
                      {/* Show duplicate warning if duplicate detected */}
                      {message.sender === "ai" && message.recipe && duplicateWarning && duplicateWarning.messageId === message.id && (
                        <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                              ⚠️ Similar recipe already exists
                            </span>
                          </div>
                          <div className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                            <p className="font-medium mb-1">
                              "{duplicateWarning.existingRecipe.title}" ({duplicateWarning.existingRecipe.similarity}% similar)
                            </p>
                            {duplicateWarning.existingRecipe.description && (
                              <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                                {duplicateWarning.existingRecipe.description.substring(0, 100)}...
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleUpdateExisting}
                              disabled={updateRecipeMutation.isPending || createRecipeMutation.isPending}
                              size="sm"
                              variant="default"
                              className="text-xs bg-yellow-600 dark:bg-yellow-700 text-white hover:bg-yellow-700 dark:hover:bg-yellow-800"
                            >
                              {updateRecipeMutation.isPending ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                "Update Existing"
                              )}
                            </Button>
                            <Button
                              onClick={handleForceSave}
                              disabled={createRecipeMutation.isPending || updateRecipeMutation.isPending}
                              size="sm"
                              variant="outline"
                              className="text-xs border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                            >
                              {createRecipeMutation.isPending ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Save Anyway"
                              )}
                            </Button>
                            <Button
                              onClick={handleCancelDuplicate}
                              size="sm"
                              variant="ghost"
                              className="text-xs text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Show success indicator if recipe was stored */}
                      {message.sender === "ai" && message.recipe && message.recipeStored && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Recipe "{message.recipe.title}" saved successfully!
                          </span>
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

