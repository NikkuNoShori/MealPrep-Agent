import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, Settings, ChevronDown, Home } from "lucide-react";
import { useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import React from "react";

const Header = () => {
  const { user, signOut } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setAvatarError(false);
  }, [user?.id, user?.avatar_url]);

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Chat", href: "/chat" },
    { name: "Recipes", href: "/recipes" },
    { name: "Meal Planner", href: "/meal-planner" },
  ];

  const getFirstName = () => {
    if (user?.first_name) return user.first_name;
    if (user?.display_name) return user.display_name.split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "User";
  };

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
    }, 200);
  };

  const handleChatClick = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem("chat-current-conversation-id");
    localStorage.setItem("chat-create-temporary-session", "true");
    navigate("/chat");
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="relative z-20 border-b border-stone-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow duration-300">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
              MealPrep <span className="text-primary-500">Agent</span>
            </span>
          </Link>

          {/* Desktop Navigation — pill tabs */}
          <nav className="hidden md:flex items-center">
            <div className="flex items-center bg-stone-100/80 dark:bg-white/[0.04] rounded-xl p-1 gap-0.5">
              {navigation.map((item) => {
                const active = isActive(item.href);
                const baseClasses = `relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  active
                    ? "bg-white dark:bg-white/10 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-stone-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
                }`;

                return item.name === "Chat" ? (
                  <button key={item.name} onClick={handleChatClick} className={baseClasses}>
                    {item.name}
                  </button>
                ) : (
                  <Link key={item.name} to={item.href} className={baseClasses}>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Menu & Mobile */}
          <div className="flex items-center space-x-3">
            {user && (
              <div
                className="relative"
                ref={userMenuRef}
                onMouseEnter={handleUserMenuMouseEnter}
                onMouseLeave={handleUserMenuMouseLeave}
              >
                <button className="flex items-center space-x-2 py-1.5 px-3 rounded-xl hover:bg-stone-100 dark:hover:bg-white/5 transition-all duration-200 group">
                  {user?.avatar_url && !avatarError ? (
                    <img
                      src={user.avatar_url}
                      alt={getFirstName()}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20 dark:ring-white/10 group-hover:ring-primary-500/30 transition-all duration-200"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      onLoad={() => setAvatarError(false)}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {getFirstName().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-stone-700 dark:text-gray-300">
                    {getFirstName()}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-900 backdrop-blur-xl rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 border border-stone-200/80 dark:border-white/10 py-1.5 z-50 animate-scale-in origin-top-right">
                    <div className="px-4 py-2.5 border-b border-stone-100 dark:border-white/5">
                      <p className="text-sm font-medium text-stone-900 dark:text-white">{user?.display_name || getFirstName()}</p>
                      <p className="text-xs text-stone-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/household"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-4 py-2 text-left text-sm text-stone-600 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-white/5 flex items-center space-x-2.5 transition-colors"
                      >
                        <Home className="w-4 h-4 text-stone-400 dark:text-gray-500" />
                        <span>Household</span>
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-4 py-2 text-left text-sm text-stone-600 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-white/5 flex items-center space-x-2.5 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-stone-400 dark:text-gray-500" />
                        <span>Settings</span>
                      </Link>
                      <button
                        onClick={() => { setIsUserMenuOpen(false); signOut(); }}
                        className="w-full px-4 py-2 text-left text-sm text-stone-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 flex items-center space-x-2.5 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-stone-400 dark:text-gray-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-stone-100/80 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 transition-colors"
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
          <div className="md:hidden py-4 border-t border-stone-200/60 dark:border-white/[0.06] animate-slide-up">
            <nav className="flex flex-col space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href);
                const classes = `px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  active
                    ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400"
                    : "text-stone-600 dark:text-gray-300 hover:bg-stone-100 dark:hover:bg-white/5"
                }`;

                return item.name === "Chat" ? (
                  <button
                    key={item.name}
                    onClick={(e) => { handleChatClick(e); setIsMobileMenuOpen(false); }}
                    className={`${classes} text-left`}
                  >
                    {item.name}
                  </button>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={classes}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
