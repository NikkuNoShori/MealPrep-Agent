import { Routes, Route } from 'react-router-dom'
import { useEffect } from "react";
import { ThemeProvider } from "./providers/ThemeProvider";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/common/Layout";
import LandingPage from "./pages/LandingPage";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Recipes from "./pages/Recipes";
import MealPlanner from "./pages/MealPlanner";
import Settings from "./pages/Settings";
import { useAuthStore } from "./stores/authStore";

function AppRoutes() {
  const { initialize } = useAuthStore();

  // Initialize auth on app mount (only once)
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
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
