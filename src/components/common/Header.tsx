import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, User, Settings } from "lucide-react";
import { useTheme } from "../../providers/ThemeProvider";
import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "../ui/button";
import React from "react";

const Header = () => {
  const { theme, setTheme, isDark } = useTheme();
  const { user, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset avatar error when user changes
  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.id, user?.avatar_url]);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Chat", href: "/chat" },
    { name: "Recipes", href: "/recipes" },
    { name: "Meal Planner", href: "/meal-planner" },
  ];

  // Get first name from user object
  const getFirstName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.display_name) return user.display_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "User";
  };

  // Handle user menu hover
  const handleUserMenuMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsUserMenuOpen(true);
  };

  const handleUserMenuMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 150);
  };

  const handleChatClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Clear any existing chat state to ensure a fresh session
    localStorage.removeItem("chat-current-conversation-id");
    // Set a flag to indicate we want a fresh temporary session
    localStorage.setItem("chat-create-temporary-session", "true");
    navigate("/chat");
  };

  return (
    <header className="bg-gradient-to-r from-primary-50 via-slate-50 to-secondary-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 shadow-sm border-b border-primary-200/50 dark:border-slate-700/50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-bold text-stone-900 dark:text-white">
              MealPrep Agent
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) =>
              item.name === "Chat" ? (
                <button
                  key={item.name}
                  onClick={handleChatClick}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.href
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                >
                  {item.name}
                </button>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.href
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              )
            )}
          </nav>

          {/* User Menu & Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            {/* User Menu */}
            {user && (
              <div
                className="relative"
                ref={userMenuRef}
                onMouseEnter={handleUserMenuMouseEnter}
                onMouseLeave={handleUserMenuMouseLeave}
              >
                <button className="flex items-center space-x-2 p-2 rounded-lg hover:opacity-80 transition-opacity">
                  {user?.avatar_url && !avatarError ? (
                    <img
                      src={user.avatar_url}
                      alt={getFirstName()}
                      className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-slate-600"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                          onError={() => {
                            // If image fails to load, show icon instead
                            setAvatarError(true);
                          }}
                      onLoad={() => {
                        // Reset error state if image loads successfully
                        setAvatarError(false);
                      }}
                    />
                  ) : (
                    <User className="w-5 h-5 text-stone-600 dark:text-gray-300" />
                  )}
                  <span className="text-sm font-medium text-stone-700 dark:text-gray-300">
                    Hey, {getFirstName()}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-700 backdrop-blur-sm rounded-lg shadow-lg border border-primary-200/50 dark:border-slate-600/50 py-1 z-50">
                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-slate-600 flex items-center space-x-2 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Link>
                    <button
                      onClick={signOut}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-slate-600 flex items-center space-x-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-stone-100 dark:bg-slate-700 hover:bg-stone-200 dark:hover:bg-slate-600 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-stone-600 dark:text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 text-stone-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-primary-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
            <nav className="flex flex-col space-y-4">
              {navigation.map((item) =>
                item.name === "Chat" ? (
                  <button
                    key={item.name}
                    onClick={(e) => {
                      handleChatClick(e);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`text-sm font-medium transition-colors text-left ${
                      location.pathname === item.href
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    {item.name}
                  </button>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === item.href
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
