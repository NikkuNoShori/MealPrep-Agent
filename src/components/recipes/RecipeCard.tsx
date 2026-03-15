import React, { useState, useEffect, useRef } from "react";
import { Clock, Users, ChefHat, Edit, Trash2, ThumbsUp, ThumbsDown, MoreVertical, Share2, Check } from "lucide-react";
import AddToPlanButton from "@/components/meal-planning/AddToPlanButton";

export interface RecipeReaction {
  id: string;
  recipeId: string;
  userId?: string;
  familyMemberId?: string;
  reaction: "thumbs_up" | "thumbs_down";
  name: string;
}

interface RecipeCardProps {
  recipe: {
    id: string;
    slug?: string;
    title: string;
    description?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: "easy" | "medium" | "hard";
    tags?: string[];
    imageUrl?: string;
    rating?: number;
    familyPreferences?: {
      [memberId: string]: "love" | "like" | "neutral" | "dislike";
    };
    author?: {
      displayName?: string;
      username?: string;
      avatarUrl?: string;
    };
  };
  viewMode: "grid" | "list";
  reactions?: RecipeReaction[];
  dependents?: { id: string; name: string }[];
  onReact?: (recipeId: string, reaction: "thumbs_up" | "thumbs_down", familyMemberId?: string) => void;
  onClick?: () => void;
  onEdit?: (recipe: any) => void;
  onDelete?: (recipeId: string) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  viewMode,
  reactions = [],
  dependents = [],
  onReact,
  onClick,
  onEdit,
  onDelete,
}) => {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  // Overflow menu state
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const path = recipe.slug ? `/recipes/${recipe.slug}` : `/recipes/${recipe.id}`;
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
    setShowOverflowMenu(false);
  };

  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showOverflowMenu]);

  // Reaction helpers
  const thumbsUp = reactions.filter((r) => r.reaction === "thumbs_up");
  const thumbsDown = reactions.filter((r) => r.reaction === "thumbs_down");
  const hasReactions = thumbsUp.length > 0 || thumbsDown.length > 0;

  const [showReactionTooltip, setShowReactionTooltip] = useState<"up" | "down" | null>(null);
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showReactionPopover, setShowReactionPopover] = useState(false);
  const reactionPopoverRef = useRef<HTMLDivElement>(null);

  const handleReactionMouseEnter = (type: "up" | "down") => {
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    reactionTimeoutRef.current = setTimeout(() => setShowReactionTooltip(type), 300);
  };

  const handleReactionMouseLeave = () => {
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    setShowReactionTooltip(null);
  };

  const handleReactionClick = (e: React.MouseEvent, reaction: "thumbs_up" | "thumbs_down", familyMemberId?: string) => {
    e.stopPropagation();
    onReact?.(recipe.id, reaction, familyMemberId);
  };

  useEffect(() => {
    if (!showReactionPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (reactionPopoverRef.current && !reactionPopoverRef.current.contains(e.target as Node)) {
        setShowReactionPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReactionPopover]);

  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    };
  }, []);

  // ── Shared sub-components ──

  const ReactionBadges = ({ size = "sm" }: { size?: "sm" | "md" }) => {
    if (!hasReactions) return null;
    const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
    const textSize = size === "sm" ? "text-[11px]" : "text-xs";
    const px = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

    return (
      <div className="flex items-center gap-1.5">
        {thumbsUp.length > 0 && (
          <div
            className={`relative inline-flex items-center gap-1 ${px} rounded-full bg-primary-500/10 dark:bg-primary-400/10 cursor-default`}
            onMouseEnter={() => handleReactionMouseEnter("up")}
            onMouseLeave={handleReactionMouseLeave}
          >
            <ThumbsUp className={`${iconSize} text-primary-500 dark:text-primary-400`} />
            <span className={`${textSize} font-semibold text-primary-600 dark:text-primary-300`}>{thumbsUp.length}</span>
            {showReactionTooltip === "up" && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium rounded-lg px-3 py-1.5 shadow-xl whitespace-nowrap pointer-events-none">
                {thumbsUp.map((r) => r.name).join(", ")}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 dark:bg-stone-100 rotate-45" />
              </div>
            )}
          </div>
        )}
        {thumbsDown.length > 0 && (
          <div
            className={`relative inline-flex items-center gap-1 ${px} rounded-full bg-rose-500/10 dark:bg-rose-400/10 cursor-default`}
            onMouseEnter={() => handleReactionMouseEnter("down")}
            onMouseLeave={handleReactionMouseLeave}
          >
            <ThumbsDown className={`${iconSize} text-rose-500 dark:text-rose-400`} />
            <span className={`${textSize} font-semibold text-rose-600 dark:text-rose-300`}>{thumbsDown.length}</span>
            {showReactionTooltip === "down" && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium rounded-lg px-3 py-1.5 shadow-xl whitespace-nowrap pointer-events-none">
                {thumbsDown.map((r) => r.name).join(", ")}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 dark:bg-stone-100 rotate-45" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const ReactionButtons = ({ compact = false }: { compact?: boolean }) => {
    if (!onReact) return null;
    const btnSize = compact ? "w-7 h-7" : "w-8 h-8";
    const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

    return (
      <div className="flex items-center gap-1" ref={reactionPopoverRef}>
        <button
          onClick={(e) => handleReactionClick(e, "thumbs_up")}
          className={`${btnSize} rounded-full bg-white/90 dark:bg-white/10 backdrop-blur-md shadow-sm flex items-center justify-center hover:bg-primary-50 dark:hover:bg-primary-500/20 hover:scale-110 active:scale-95 transition-all duration-150`}
          title="Thumbs up"
        >
          <ThumbsUp className={`${iconSize} text-primary-600 dark:text-primary-400`} />
        </button>
        <button
          onClick={(e) => handleReactionClick(e, "thumbs_down")}
          className={`${btnSize} rounded-full bg-white/90 dark:bg-white/10 backdrop-blur-md shadow-sm flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:scale-110 active:scale-95 transition-all duration-150`}
          title="Thumbs down"
        >
          <ThumbsDown className={`${iconSize} text-rose-500 dark:text-rose-400`} />
        </button>
        {dependents.length > 0 && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowReactionPopover(!showReactionPopover); }}
              className={`${btnSize} rounded-full bg-white/90 dark:bg-white/10 backdrop-blur-md shadow-sm flex items-center justify-center hover:bg-primary-500/10 dark:hover:bg-primary-500/20 hover:scale-110 active:scale-95 transition-all duration-150`}
              title="React for family member"
            >
              <Users className={`${iconSize} text-stone-500 dark:text-stone-400`} />
            </button>
            {showReactionPopover && (
              <div
                className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#16171c] rounded-xl shadow-2xl shadow-black/20 border border-stone-200/80 dark:border-white/10 py-1.5 min-w-[200px] z-[100] animate-scale-in origin-bottom-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">React for</div>
                {dependents.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between px-3 py-2 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors">
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{dep.name}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={(e) => { handleReactionClick(e, "thumbs_up", dep.id); setShowReactionPopover(false); }}
                        className="w-7 h-7 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-500/20 flex items-center justify-center transition-colors"
                      >
                        <ThumbsUp className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                      </button>
                      <button
                        onClick={(e) => { handleReactionClick(e, "thumbs_down", dep.id); setShowReactionPopover(false); }}
                        className="w-7 h-7 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center transition-colors"
                      >
                        <ThumbsDown className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const OverflowMenu = ({ position = "bottom-right" }: { position?: "bottom-right" | "bottom-left" }) => {
    const hasActions = onEdit || onDelete;
    if (!hasActions) {
      // Still show share-only button
      return (
        <button
          onClick={handleShare}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-white/10 backdrop-blur-md shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-150"
          title={copiedLink ? "Copied!" : "Share"}
        >
          {copiedLink ? <Check className="h-3.5 w-3.5 text-primary-500" /> : <Share2 className="h-3.5 w-3.5 text-stone-600 dark:text-stone-300" />}
        </button>
      );
    }

    return (
      <div className="relative" ref={overflowMenuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(!showOverflowMenu); }}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-white/10 backdrop-blur-md shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-150"
          title="More options"
        >
          <MoreVertical className="h-4 w-4 text-stone-600 dark:text-stone-300" />
        </button>
        {showOverflowMenu && (
          <div
            className="absolute z-[100] top-full right-0 mt-1.5 origin-top-right animate-scale-in bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl rounded-lg shadow-lg shadow-black/10 dark:shadow-black/30 border border-stone-200/50 dark:border-white/[0.08] py-1 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleShare}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-primary-500" /> : <Share2 className="h-3.5 w-3.5" />}
              {copiedLink ? "Copied!" : "Copy link"}
            </button>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(false); onEdit(recipe); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowOverflowMenu(false); onDelete(recipe.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── List View ──
  if (viewMode === "list") {
    return (
      <div onClick={onClick} className="group cursor-pointer">
        <div className="flex items-stretch gap-4 p-3 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/[0.06] hover:bg-white dark:hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20 hover:border-stone-300/60 dark:hover:border-white/[0.1] transition-all duration-300">
          {/* Image */}
          <div className="relative w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-stone-100 to-stone-200/80 dark:from-stone-800 dark:to-stone-700">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ChefHat className="h-10 w-10 text-stone-300 dark:text-stone-600" />
              </div>
            )}
            {/* Time chip on image */}
            {totalTime > 0 && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
                <Clock className="h-3 w-3 text-white/80" />
                <span className="text-[11px] font-medium text-white">{totalTime}m</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            {/* Top: title + actions */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[15px] text-stone-900 dark:text-white leading-snug truncate" title={recipe.title}>
                    {recipe.title}
                  </h3>
                  {recipe.author && (
                    <p className="text-[12px] text-stone-400 dark:text-stone-500 mt-0.5">
                      @{recipe.author.username || recipe.author.displayName}
                    </p>
                  )}
                </div>
                {/* Hover actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                  <ReactionButtons compact />
                  <AddToPlanButton
                    recipeId={recipe.id}
                    recipeName={recipe.title}
                    recipeImage={recipe.imageUrl}
                    servings={recipe.servings}
                    prepTime={recipe.prepTime}
                    cookTime={recipe.cookTime}
                    compact
                  />
                  <OverflowMenu />
                </div>
              </div>
              {recipe.description && (
                <p className="text-[13px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                  {recipe.description}
                </p>
              )}
            </div>

            {/* Bottom: meta + reactions */}
            <div className="flex items-center justify-between gap-3 mt-auto">
              <div className="flex items-center gap-3 text-[12px] text-stone-400 dark:text-stone-500">
                {recipe.servings && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {recipe.servings}
                  </span>
                )}
                {recipe.tags && recipe.tags.slice(0, 2).map((tag, i) => (
                  <span key={i} className="text-stone-400 dark:text-stone-500">{tag}</span>
                ))}
                {recipe.tags && recipe.tags.length > 2 && (
                  <span className="text-stone-300 dark:text-stone-600">+{recipe.tags.length - 2}</span>
                )}
              </div>
              <ReactionBadges size="sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Grid View ──
  return (
    <div onClick={onClick} className="group h-full cursor-pointer">
      <div className="h-full rounded-2xl overflow-hidden bg-white dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/[0.06] hover:shadow-xl hover:shadow-black/[0.08] dark:hover:shadow-black/30 hover:border-stone-300/80 dark:hover:border-white/[0.1] hover:-translate-y-1 transition-all duration-300 flex flex-col">
        {/* Image area */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200/80 dark:from-stone-800 dark:via-stone-800 dark:to-stone-700">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-white/40 dark:bg-white/[0.06] flex items-center justify-center">
                <ChefHat className="h-8 w-8 text-stone-300 dark:text-stone-600" />
              </div>
            </div>
          )}

          {/* Gradient scrim for overlaid text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-transparent pointer-events-none" />

          {/* Top-right: overflow menu */}
          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <OverflowMenu />
          </div>

          {/* Bottom-left: time + servings overlaid on image */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
            {totalTime > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md">
                <Clock className="h-3 w-3 text-white/80" />
                <span className="text-[11px] font-medium text-white/90">{totalTime}m</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md">
                <Users className="h-3 w-3 text-white/80" />
                <span className="text-[11px] font-medium text-white/90">{recipe.servings}</span>
              </div>
            )}
          </div>

          {/* Bottom-right: hover reaction buttons */}
          {onReact && (
            <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
              <ReactionButtons compact />
            </div>
          )}

          {/* Top-left: add to plan */}
          <div className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <AddToPlanButton
              recipeId={recipe.id}
              recipeName={recipe.title}
              recipeImage={recipe.imageUrl}
              servings={recipe.servings}
              prepTime={recipe.prepTime}
              cookTime={recipe.cookTime}
              compact
            />
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3">
          {/* Title */}
          <h3 className="font-semibold text-[15px] text-stone-900 dark:text-white leading-snug line-clamp-1" title={recipe.title}>
            {recipe.title}
          </h3>

          {/* Author */}
          {recipe.author && (
            <p className="text-[12px] text-stone-400 dark:text-stone-500 mt-0.5">
              @{recipe.author.username || recipe.author.displayName}
            </p>
          )}

          {/* Description */}
          {recipe.description && (
            <p className="text-[12px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-1.5 leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Spacer */}
          <div className="mt-auto" />

          {/* Footer: tags + reactions */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100 dark:border-white/[0.04]">
            {/* Tags */}
            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
              {recipe.tags && recipe.tags.slice(0, 2).map((tag, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 dark:bg-white/[0.06] text-[11px] font-medium text-stone-500 dark:text-stone-400 truncate max-w-[80px]">
                  {tag}
                </span>
              ))}
              {recipe.tags && recipe.tags.length > 2 && (
                <span className="text-[11px] text-stone-300 dark:text-stone-600 font-medium flex-shrink-0">
                  +{recipe.tags.length - 2}
                </span>
              )}
            </div>

            {/* Reaction counts */}
            <ReactionBadges size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
};
