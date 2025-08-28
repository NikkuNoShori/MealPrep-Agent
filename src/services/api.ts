import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AuthResponse, ChatHistoryResponse, ChatMessageResponse, RecipesResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// API client with authentication
class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth endpoints
  async register(data: { email: string; password: string; displayName: string }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async login(data: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  // Recipe endpoints
  async getRecipes(params?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())
    
    return this.request(`/recipes?${searchParams.toString()}`)
  }

  async getRecipe(id: string) {
    return this.request(`/recipes/${id}`)
  }

  async createRecipe(data: any) {
    return this.request('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRecipe(id: string, data: any) {
    return this.request(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteRecipe(id: string) {
    return this.request(`/recipes/${id}`, {
      method: 'DELETE',
    })
  }

  async searchRecipes(query: string, limit?: number) {
    const searchParams = new URLSearchParams({ query })
    if (limit) searchParams.append('limit', limit.toString())
    
    return this.request(`/recipes/search/${query}?${searchParams.toString()}`)
  }

  // Chat endpoints
  async sendMessage(data: { message: string; context?: any }) {
    return this.request('/chat/message', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async addRecipeViaChat(data: { recipeText: string }) {
    return this.request('/chat/add-recipe', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getChatHistory(limit?: number) {
    const searchParams = new URLSearchParams()
    if (limit) searchParams.append('limit', limit.toString())
    
    return this.request(`/chat/history?${searchParams.toString()}`)
  }

  async clearChatHistory() {
    return this.request('/chat/history', {
      method: 'DELETE',
    })
  }

  // Meal planning endpoints
  async getMealPlans(limit?: number) {
    const searchParams = new URLSearchParams()
    if (limit) searchParams.append('limit', limit.toString())
    
    return this.request(`/meal-plans?${searchParams.toString()}`)
  }

  async createMealPlan(data: { startDate: string; endDate: string; preferences: any }) {
    return this.request('/meal-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Receipt endpoints
  async getReceipts(limit?: number) {
    const searchParams = new URLSearchParams()
    if (limit) searchParams.append('limit', limit.toString())
    
    return this.request(`/receipts?${searchParams.toString()}`)
  }

  async uploadReceipt(data: { imageUrl: string; storeInfo: any }) {
    return this.request('/receipts/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Preferences endpoints
  async getPreferences() {
    return this.request('/preferences')
  }

  async updatePreferences(data: any) {
    return this.request('/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL)

// React Query hooks
export const useRecipes = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ['recipes', params],
    queryFn: () => apiClient.getRecipes(params),
  })
}

export const useRecipe = (id: string) => {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => apiClient.getRecipe(id),
    enabled: !!id,
  })
}

export const useCreateRecipe = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: any) => apiClient.createRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

export const useUpdateRecipe = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiClient.updateRecipe(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['recipe', id] })
    },
  })
}

export const useDeleteRecipe = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
    },
  })
}

export const useSearchRecipes = (query: string, limit?: number) => {
  return useQuery({
    queryKey: ['recipes', 'search', query, limit],
    queryFn: () => apiClient.searchRecipes(query, limit),
    enabled: !!query,
  })
}

export const useChatHistory = (limit?: number) => {
  return useQuery({
    queryKey: ['chat', 'history', limit],
    queryFn: () => apiClient.getChatHistory(limit),
  })
}

export const useSendMessage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: { message: string; context?: any }) => apiClient.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'history'] })
    },
  })
}

export const useMealPlans = (limit?: number) => {
  return useQuery({
    queryKey: ['meal-plans', limit],
    queryFn: () => apiClient.getMealPlans(limit),
  })
}

export const useCreateMealPlan = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: { startDate: string; endDate: string; preferences: any }) => apiClient.createMealPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
    },
  })
}

export const usePreferences = () => {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => apiClient.getPreferences(),
  })
}

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: any) => apiClient.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
  })
}
