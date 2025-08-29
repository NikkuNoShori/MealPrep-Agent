import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiClient } from '../services/api'

interface User {
  uid: string
  email: string
  displayName: string
  householdSize?: number
  dietaryRestrictions?: string[]
  allergies?: string[]
  favoriteIngredients?: string[]
  dislikedIngredients?: string[]
  cuisinePreferences?: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on app load
    const savedToken = localStorage.getItem('authToken')
    if (savedToken) {
      setToken(savedToken)
      apiClient.setToken(savedToken)
      fetchCurrentUser()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const response = (await apiClient.getCurrentUser()) as any;
      setUser(response.user);
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      // Clear invalid token
      localStorage.removeItem("authToken");
      setToken(null);
      apiClient.clearToken();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = (await apiClient.login({ email, password })) as any;
      const { token: newToken, user: userData } = response;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("authToken", newToken);
      apiClient.setToken(newToken);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    try {
      const response = (await apiClient.register({
        email,
        password,
        displayName,
      })) as any;
      const { token: newToken, user: userData } = response;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("authToken", newToken);
      apiClient.setToken(newToken);
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('authToken')
    apiClient.clearToken()
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
