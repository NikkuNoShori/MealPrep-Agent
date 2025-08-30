import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from "./providers/ThemeProvider";
import Layout from "./components/common/Layout";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Recipes from "./pages/Recipes";
import MealPlanner from "./pages/MealPlanner";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <Layout>
            <Dashboard />
          </Layout>
        }
      />
      <Route
        path="/chat"
        element={
          <Layout>
            <Chat />
          </Layout>
        }
      />
      <Route
        path="/recipes"
        element={
          <Layout>
            <Recipes />
          </Layout>
        }
      />
      <Route
        path="/meal-planner"
        element={
          <Layout>
            <MealPlanner />
          </Layout>
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
