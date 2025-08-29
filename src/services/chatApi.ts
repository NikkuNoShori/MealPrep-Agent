import { apiClient } from "./api";
import { useState, useCallback } from "react";

export interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "ai";
  type?: string;
  timestamp: Date;
}

export interface SendMessageRequest {
  message: string;
  context?: string;
}

export interface SendMessageResponse {
  message: string;
  userMessage: ChatMessage;
  aiResponse: ChatMessage;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface AddRecipeRequest {
  recipeText: string;
}

export interface AddRecipeResponse {
  message: string;
  recipe: {
    id: string;
    title: string;
    description?: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: string;
    cuisineType?: string;
    dietaryTags?: string[];
    createdAt: Date;
  };
  confirmation: string;
}

// Chat API service using edge function
export const chatApi = {
  // Send a chat message
  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    return apiClient.sendMessage(data) as Promise<SendMessageResponse>;
  },

  // Get chat history
  async getHistory(limit: number = 50): Promise<ChatHistoryResponse> {
    return apiClient.getChatHistory(limit) as Promise<ChatHistoryResponse>;
  },

  // Add recipe through chat
  async addRecipe(data: AddRecipeRequest): Promise<AddRecipeResponse> {
    return apiClient.addRecipeViaChat(data) as Promise<AddRecipeResponse>;
  },

  // Clear chat history
  async clearHistory(): Promise<{ message: string }> {
    return apiClient.clearChatHistory() as Promise<{ message: string }>;
  },
};

// React hooks for chat functionality
export const useChatHistory = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (limit: number = 50) => {
    setLoading(true);
    setError(null);
    try {
      const response = await chatApi.getHistory(limit);
      setMessages(response.messages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch chat history"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await chatApi.clearHistory();
      setMessages([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear chat history"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    messages,
    loading,
    error,
    fetchHistory,
    clearHistory,
  };
};

export const useSendMessage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string, context?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await chatApi.sendMessage({ message, context });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sendMessage,
    loading,
    error,
  };
};

export const useAddRecipe = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRecipe = useCallback(async (recipeText: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await chatApi.addRecipe({ recipeText });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add recipe");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    addRecipe,
    loading,
    error,
  };
};
