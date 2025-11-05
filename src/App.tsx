import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { ThemeProvider } from "./providers/ThemeProvider";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/common/Layout";
import LandingPage from "./pages/LandingPage";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Recipes from "./pages/Recipes";
import MealPlanner from "./pages/MealPlanner";
import Settings from "./pages/Settings";
import { useAuthStore } from "./stores/authStore";
import { Logger } from "./services/logger";

function AppRoutes() {
  // Initialize auth when app starts - check for existing session/cookies
  const { initialize, setupAuthListener } = useAuthStore()
  
  useEffect(() => {
    // Initialize auth on app startup to check for existing session
    // This will check Stack Auth cookies and set user state if logged in
    Logger.info('🚀 AppRoutes: Initializing auth on startup...')
    initialize().then(() => {
      // Set up listener for auth state changes after initialization
      Logger.info('🚀 AppRoutes: Setting up auth state listener...')
      setupAuthListener()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/handler/password-reset" element={<ResetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout>
              <Chat />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipes"
        element={
          <ProtectedRoute>
            <Layout>
              <Recipes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/meal-planner"
        element={
          <ProtectedRoute>
            <Layout>
              <MealPlanner />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  )
}

export default App
