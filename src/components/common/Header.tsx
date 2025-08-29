import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, ChevronDown, Sun, Moon } from "lucide-react";
import { useTheme } from "../../providers/ThemeProvider";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useState, useRef, useEffect } from "react";

const Header = () => {
  const { theme, setTheme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Chat", href: "/chat" },
    { name: "Recipes", href: "/recipes" },
    { name: "Meal Planner", href: "/meal-planner" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Get first name from display name
  const getFirstName = (displayName: string) => {
    return displayName.split(" ")[0] || displayName;
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

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-stone-200 dark:border-gray-700">
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
          {user && (
            <nav className="hidden md:flex items-center space-x-8">
              {navigation.map((item) => (
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
              ))}
            </nav>
          )}

          {/* User Menu & Theme Toggle */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div
                className="relative hidden md:block"
                onMouseEnter={handleUserMenuMouseEnter}
                onMouseLeave={handleUserMenuMouseLeave}
                ref={userMenuRef}
              >
                {/* User Menu Button */}
                <button
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <User className="h-4 w-4 text-stone-600 dark:text-gray-300" />
                  <span className="text-sm font-medium text-stone-900 dark:text-white">
                    {getFirstName(user.displayName)}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-stone-600 dark:text-gray-300 transition-transform ${
                      isUserMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* User Menu Dropdown */}
                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-stone-200 dark:border-gray-700 py-1 z-50"
                    onMouseEnter={handleUserMenuMouseEnter}
                    onMouseLeave={handleUserMenuMouseLeave}
                  >
                    <div className="px-4 py-2 border-b border-stone-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-stone-900 dark:text-white">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>

                    {/* Theme Toggle */}
                    <div className="px-4 py-2 border-b border-stone-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-700 dark:text-gray-300">
                          Theme
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log(
                              "Theme toggle clicked, current theme:",
                              theme
                            );
                            setTheme(theme === "dark" ? "light" : "dark");
                          }}
                          className="p-1 rounded hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label={`Switch to ${
                            isDark ? "light" : "dark"
                          } mode`}
                        >
                          {isDark ? (
                            <Sun className="h-4 w-4 text-stone-600 dark:text-gray-300" />
                          ) : (
                            <Moon className="h-4 w-4 text-stone-600 dark:text-gray-300" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Logout Button */}
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth">
                <Button size="sm">Sign In</Button>
              </Link>
            )}

            {/* Mobile Theme Toggle */}
            {user && (
              <div className="md:hidden">
                <ThemeToggle />
              </div>
            )}

            {user && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-stone-100 dark:bg-gray-700 hover:bg-stone-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-stone-600 dark:text-gray-300" />
                ) : (
                  <Menu className="w-5 h-5 text-stone-600 dark:text-gray-300" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && user && (
          <div className="md:hidden py-4 border-t border-stone-200 dark:border-gray-700">
            <nav className="flex flex-col space-y-4">
              <div className="flex items-center space-x-2 text-sm text-stone-600 dark:text-gray-300 mb-4">
                <User className="h-4 w-4" />
                <span>{getFirstName(user.displayName)}</span>
              </div>
              {navigation.map((item) => (
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
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="justify-start"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header
