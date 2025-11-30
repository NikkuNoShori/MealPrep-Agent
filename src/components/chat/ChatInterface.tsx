import React, { useState, useRef, useEffect } from 'react'
import { useSendMessage } from "../../services/api";
import { ragService, formatRecipeContext } from "../../services/ragService";
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
} from "lucide-react";
import { ChatMessageResponse } from "../../types";
import { useAuthStore } from "../../stores/authStore";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: string;
  timestamp: Date;
  sessionId: string; // Add sessionId for n8n context
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = useSendMessage();
  const { user } = useAuthStore();

  // Get user's first name
  const getFirstName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.display_name) return user.display_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "there";
  };

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
        const conversationsWithDates = parsedConversations.map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
          isTemporary: conv.isTemporary || false, // Ensure isTemporary is set
          selectedIntent: conv.selectedIntent || null, // Restore selected intent
          sessionId: conv.sessionId || `session-${Date.now()}`, // Ensure sessionId is preserved
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
          // Restore the saved conversation and log sessionId for debugging
          const restoredConversation = conversationsWithDates.find(
            (c: Conversation) => c.id === savedCurrentId
          );
          console.log(
            "Restoring conversation with sessionId:",
            restoredConversation?.sessionId
          );
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
      selectedIntent: null, // No intent selected yet
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
      selectedIntent: null, // No intent selected yet
    };
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setInputMessage("");
  };

  // Handle intent selection via button click
  const handleIntentSelection = (intent: "recipe_extraction" | null) => {
    if (!currentConversationId) return;

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, selectedIntent: intent }
          : conv
      )
    );
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentConversationId) return;

    const currentConversation = getCurrentConversation();
    if (!currentConversation) return;

    // Use manually selected intent (or null for RAG queries)
    const intent = currentConversation.selectedIntent || null;
    console.log("Using selected intent:", intent);

    // Add message to history
    setMessageHistory((prev) => [
      inputMessage,
      ...prev.filter((msg) => msg !== inputMessage),
    ]);
    setHistoryIndex(-1);
    setTempInput("");

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
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
              lastMessage: inputMessage,
              timestamp: new Date(),
              title:
                conv.messages.length === 0
                  ? inputMessage.slice(0, 30) + "..."
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
        // Handle recipe extraction
        response = (await sendMessageMutation.mutateAsync({
          message: inputMessage,
          sessionId: currentConversation.sessionId,
          intent: "recipe_extraction",
          context: {
            recentMessages: currentConversation.messages.slice(-5),
          },
        })) as ChatMessageResponse;
      } else {
        // Handle RAG-based queries (all non-extraction intents)
        let recipeContext = "";

        // Always perform RAG search for better context
        try {
          const ragResults = await ragService.searchRecipes({
            query: inputMessage,
            userId: user?.id || "test-user",
            limit: 5,
            searchType: "hybrid",
          });
          recipeContext = formatRecipeContext(ragResults.results);
        } catch (ragError) {
          console.warn(
            "RAG search failed, proceeding without context:",
            ragError
          );
        }

        response = (await sendMessageMutation.mutateAsync({
          message: inputMessage,
          sessionId: currentConversation.sessionId,
          intent: undefined, // No specific intent for RAG queries
          context: {
            recentMessages: currentConversation.messages.slice(-5),
            recipeContext: recipeContext,
          },
        })) as ChatMessageResponse;
      }

      const aiMessage: Message = {
        id: response.response.id,
        content: response.response.content,
        sender: "ai",
        timestamp: new Date(response.response.timestamp),
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
    } catch (error) {
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
    <div className="flex h-full min-h-0">
      {/* Sidebar - Conversation History */}
      <div className="w-80 bg-gradient-to-b from-primary-50/30 via-slate-50 to-secondary-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 border-r border-primary-200/50 dark:border-gray-700 flex flex-col min-h-0">
        {/* Header with New Chat and Multi-select */}
        <div className="p-3 border-b border-primary-200/50 dark:border-gray-700 bg-white/50 dark:bg-transparent backdrop-blur-sm">
          <div className="flex gap-2">
            <Button
              onClick={createNewConversation}
              variant="outline"
              size="icon"
              title="New Chat"
              className="h-8 w-8 flex-1 bg-transparent dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"
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
                    className="h-8 w-8 flex-1 bg-transparent dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"
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
                      className="h-8 w-8 flex-1 bg-transparent dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"
                      title="Select All"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={clearSelection}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-1 bg-transparent dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"
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
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 border-b border-primary-100/50 dark:border-gray-700 cursor-pointer hover:bg-primary-100/50 dark:hover:bg-gray-700 transition-colors group ${
                currentConversationId === conversation.id
                  ? "bg-gradient-to-r from-primary-100/80 to-secondary-100/80 dark:from-primary-900/30 dark:to-secondary-900/30 border-primary-300 dark:border-primary-700 shadow-sm"
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
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/20 dark:from-slate-900 dark:via-gray-900 dark:to-gray-900">
        <Card className="flex-1 flex flex-col min-h-0 bg-transparent border-0 shadow-none">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {!currentConversation ||
              currentConversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-6">
                    Hey {getFirstName()}, where do you want to start?
                  </h2>
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
                      Questions about an existing recipe
                    </Button>
                  </div>
                </div>
              ) : (
                currentConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.sender === "ai" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.sender === "user"
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      <p
                        className={`text-sm whitespace-pre-wrap ${
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
              {currentConversation &&
              currentConversation.selectedIntent === null &&
              currentConversation.messages.length === 0 ? (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Please select an option above to start chatting
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      currentConversation?.selectedIntent ===
                      "recipe_extraction"
                        ? "Paste or type your recipe here..."
                        : "Ask me about your recipes..."
                    }
                    disabled={isLoading || !currentConversation?.selectedIntent}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      !inputMessage.trim() ||
                      isLoading ||
                      !currentConversation?.selectedIntent
                    }
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
