import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, Settings, ChevronDown, Home, Shield } from "lucide-react";
import { useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import React from "react";

const Header = () => {
  const { user, signOut, isAdmin } = useAuthStore();
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
    <header className="relative z-20 border-b border-stone-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-[#16171c]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-primary-500 dark:bg-primary-400 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200">
              <span className="text-white font-bold text-xs" style={{ fontFamily: "'Fraunces', serif" }}>M</span>
            </div>
            <span className="text-base font-semibold text-stone-900 dark:text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              MealPrep
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center">
            <div className="flex items-center gap-1">
              {navigation.map((item) => {
                const active = isActive(item.href);
                const baseClasses = `relative px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                  active
                    ? "text-primary-500 dark:text-primary-400"
                    : "text-stone-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-white"
                }`;

                const indicator = active ? <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary-500 dark:bg-primary-400" /> : null;

                return item.name === "Chat" ? (
                  <button key={item.name} onClick={handleChatClick} className={baseClasses} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {item.name}
                    {indicator}
                  </button>
                ) : (
                  <Link key={item.name} to={item.href} className={baseClasses} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {item.name}
                    {indicator}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Menu & Mobile */}
          <div className="flex items-center gap-2">
            {user && (
              <div
                className="relative"
                ref={userMenuRef}
                onMouseEnter={handleUserMenuMouseEnter}
                onMouseLeave={handleUserMenuMouseLeave}
              >
                <button className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg transition-all duration-150 group">
                  {user?.avatar_url && !avatarError ? (
                    <img
                      src={user.avatar_url}
                      alt={getFirstName()}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-stone-200/50 dark:ring-white/10"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      onLoad={() => setAvatarError(false)}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary-500 dark:bg-primary-400 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {getFirstName().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-stone-600 dark:text-gray-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {getFirstName()}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform duration-150 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl rounded-lg shadow-lg shadow-black/10 dark:shadow-black/30 border border-stone-200/50 dark:border-white/[0.08] py-1 z-50 animate-scale-in origin-top-right">
                    <div className="px-3.5 py-2 border-b border-stone-100 dark:border-white/[0.06]">
                      <p className="text-sm font-medium text-stone-900 dark:text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>{user?.display_name || getFirstName()}</p>
                      <p className="text-xs text-stone-400 dark:text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <div className="py-0.5">
                      <Link
                        to="/household"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-3.5 py-2 text-left text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white flex items-center gap-2.5 transition-colors"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Household</span>
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full px-3.5 py-2 text-left text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white flex items-center gap-2.5 transition-colors"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="w-full px-3.5 py-2 text-left text-[13px] text-amber-600/70 dark:text-amber-400/70 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2.5 transition-colors"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </Link>
                      )}
                      <div className="my-0.5 mx-3 border-t border-stone-100 dark:border-white/[0.06]" />
                      <button
                        onClick={() => { setIsUserMenuOpen(false); signOut(); }}
                        className="w-full px-3.5 py-2 text-left text-[13px] text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 flex items-center gap-2.5 transition-colors"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-4.5 h-4.5 text-stone-600 dark:text-gray-300" />
              ) : (
                <Menu className="w-4.5 h-4.5 text-stone-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-stone-200/60 dark:border-white/[0.06] animate-slide-up">
            <nav className="flex flex-col gap-0.5">
              {navigation.map((item) => {
                const active = isActive(item.href);
                const classes = `relative px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                  active
                    ? "text-primary-500 dark:text-primary-400"
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                }`;
                const mobileIndicator = active ? <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary-500 dark:bg-primary-400" /> : null;

                return item.name === "Chat" ? (
                  <button
                    key={item.name}
                    onClick={(e) => { handleChatClick(e); setIsMobileMenuOpen(false); }}
                    className={`${classes} text-left`}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {mobileIndicator}
                    {item.name}
                  </button>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={classes}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {mobileIndicator}
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
