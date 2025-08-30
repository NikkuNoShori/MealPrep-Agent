import { Link, useLocation } from 'react-router-dom'
import { Menu, X, User, ChevronDown, Sun, Moon } from "lucide-react";
import { useTheme } from "../../providers/ThemeProvider";
import { Button } from "../ui/button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useState, useRef } from "react";

const Header = () => {
  const { theme, setTheme, isDark } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Chat", href: "/chat" },
    { name: "Recipes", href: "/recipes" },
    { name: "Meal Planner", href: "/meal-planner" },
  ];

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

          {/* Theme Toggle & Mobile Menu */}
          <div className="flex items-center space-x-4">
            {/* Desktop Theme Toggle */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            {/* Mobile Menu Button */}
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
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-stone-200 dark:border-gray-700">
            <nav className="flex flex-col space-y-4">
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
              {/* Mobile Theme Toggle */}
              <div className="pt-2 border-t border-stone-200 dark:border-gray-700">
                <ThemeToggle />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header
