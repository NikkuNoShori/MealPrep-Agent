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
} from "lucide-react";
import { ChatHistoryResponse, ChatMessageResponse } from "../../types";

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

  const { data: chatHistory } = useChatHistory(50) as {
    data: ChatHistoryResponse | undefined;
  };
  const sendMessageMutation = useSendMessage();

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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !currentConversationId) return;

    const currentConversation = getCurrentConversation();
    if (!currentConversation) return;

    // Detect intent
    const intent = detectIntent(inputMessage);
    console.log("Detected intent:", intent);

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
        // Handle RAG-based queries
        let recipeContext = "";

        if (
          intent === "recipe_search" ||
          intent === "ingredient_search" ||
          intent === "cooking_advice"
        ) {
          try {
            const ragResults = await ragService.searchRecipes({
              query: inputMessage,
              userId: "test-user", // TODO: Get actual user ID
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
        }

        response = (await sendMessageMutation.mutateAsync({
          message: inputMessage,
          sessionId: currentConversation.sessionId,
          intent: intent,
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
    <div className="flex h-full overflow-hidden">
      {/* Sidebar - Conversation History */}
      <div className="w-80 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
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
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group ${
                currentConversationId === conversation.id
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
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
        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {!currentConversation ||
              currentConversation.messages.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Welcome to MealPrep Assistant!
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Ask me anything about recipes, meal planning, or cooking
                    tips.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md mx-auto">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <BookOpen className="h-5 w-5 mx-auto mb-2 text-blue-600" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        "Add this recipe to my collection"
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <Search className="h-5 w-5 mx-auto mb-2 text-green-600" />
                      <p className="text-xs text-green-700 dark:text-green-300">
                        "Find recipes with chicken"
                      </p>
                    </div>
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
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
