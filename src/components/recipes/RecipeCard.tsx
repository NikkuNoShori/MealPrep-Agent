import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Star, ChefHat, Edit, Trash2 } from "lucide-react";

interface RecipeCardProps {
  recipe: {
    id: string;
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
  };
  viewMode: "grid" | "list";
  onClick?: () => void;
  onEdit?: (recipe: any) => void;
  onDelete?: (recipeId: string) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  viewMode,
  onClick,
  onEdit,
  onDelete,
}) => {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  // Truncate title to fit on single line
  // Grid view: ~40-45 characters at text-base (16px) in ~280-320px card width
  // List view: ~50-60 characters at text-xl (20px) with more available width
  // Using 50 as safe limit for both views
  const truncateTitle = (title: string, maxLength: number = 50): string => {
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength) + "...";
  };

  const displayTitle = truncateTitle(recipe.title);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getFamilyConsensus = () => {
    if (!recipe.familyPreferences) return null;

    const preferences = Object.values(recipe.familyPreferences);
    const loves = preferences.filter((p) => p === "love").length;
    const likes = preferences.filter((p) => p === "like").length;
    const dislikes = preferences.filter((p) => p === "dislike").length;

    if (loves > likes && loves > dislikes) return "love";
    if (likes > loves && likes > dislikes) return "like";
    if (dislikes > loves && dislikes > likes) return "dislike";
    return "neutral";
  };

  const familyConsensus = getFamilyConsensus();

  // Tooltip state with debounce
  const [showDescTooltip, setShowDescTooltip] = useState(false);
  const [showTagsTooltip, setShowTagsTooltip] = useState(false);
  const [tagsTooltipPosition, setTagsTooltipPosition] = useState({ top: 0, left: 0 });
  const descTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tagsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tagsRef = useRef<HTMLDivElement | null>(null);
  const listTagsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
      if (tagsTimeoutRef.current) clearTimeout(tagsTimeoutRef.current);
    };
  }, []);

  const handleDescMouseEnter = () => {
    if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
    descTimeoutRef.current = setTimeout(() => {
      setShowDescTooltip(true);
    }, 1000);
  };

  const handleDescMouseLeave = () => {
    if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
    setShowDescTooltip(false);
  };

  const handleTagsMouseEnter = (ref: React.RefObject<HTMLDivElement>) => {
    if (tagsTimeoutRef.current) clearTimeout(tagsTimeoutRef.current);
    tagsTimeoutRef.current = setTimeout(() => {
      const elementRef = ref.current || tagsRef.current;
      if (elementRef) {
        const rect = elementRef.getBoundingClientRect();
        setTagsTooltipPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
      setShowTagsTooltip(true);
    }, 1000);
  };

  const handleTagsMouseLeave = () => {
    if (tagsTimeoutRef.current) clearTimeout(tagsTimeoutRef.current);
    setShowTagsTooltip(false);
  };

  if (viewMode === "list") {
    return (
      <div onClick={onClick} className="group">
        <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 group-hover:scale-[1.02] p-0">
          <CardContent className="p-[10px]">
            <div className="flex items-center gap-6">
              {/* Enhanced Recipe Image */}
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex-shrink-0 overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                {recipe.imageUrl ? (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      // Hide broken images gracefully
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                {familyConsensus && (
                  <div className="absolute -top-2 -right-2">
                    <Badge
                      variant={
                        familyConsensus === "love" ? "default" : "secondary"
                      }
                      className="text-xs shadow-lg"
                    >
                      {familyConsensus === "love" && (
                        <Star className="h-3 w-3 mr-1" />
                      )}
                      {familyConsensus}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Enhanced Recipe Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200" title={recipe.title}>
                      {displayTitle}
                    </h3>
                    {recipe.description && (
                      <div
                        className="relative"
                        onMouseEnter={handleDescMouseEnter}
                        onMouseLeave={handleDescMouseLeave}
                      >
                        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mt-2 leading-relaxed cursor-help">
                          {recipe.description}
                        </p>
                        {showDescTooltip && (
                          <div className="absolute left-0 top-full mt-1 z-[100] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm rounded-lg px-3 py-2 shadow-xl max-w-xs whitespace-normal break-words">
                            {recipe.description}
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(recipe);
                        }}
                        className="h-8 w-8 p-0 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                      >
                        <Edit className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(recipe.id);
                        }}
                        className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Enhanced Recipe Meta */}
                <div className="flex items-center gap-6 mb-3">
                  {totalTime > 0 && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <span className="font-medium">{totalTime} min</span>
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-secondary-600 dark:text-secondary-400" />
                      </div>
                      <span className="font-medium">
                        {recipe.servings} servings
                      </span>
                    </div>
                  )}
                  {recipe.difficulty && (
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${getDifficultyColor(
                        recipe.difficulty
                      )} border-0`}
                    >
                      {recipe.difficulty}
                    </Badge>
                  )}
                  {recipe.rating && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                      <span className="font-medium">
                        {recipe.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Enhanced Tags */}
                <div className="flex items-center justify-end">
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div
                      ref={listTagsRef}
                      className="relative"
                      onMouseEnter={() => handleTagsMouseEnter(listTagsRef)}
                      onMouseLeave={handleTagsMouseLeave}
                    >
                      <div className="flex gap-1 cursor-help">
                        {recipe.tags.slice(0, 2).map((tag, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {recipe.tags.length > 2 && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            +{recipe.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {recipe.tags && recipe.tags.length > 2 && showTagsTooltip && (
                  <div
                    className="fixed z-[9999] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs whitespace-normal"
                    style={{
                      top: `${tagsTooltipPosition.top}px`,
                      left: `${tagsTooltipPosition.left}px`,
                    }}
                  >
                    <div className="font-semibold mb-1">All Tags:</div>
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45"></div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Grid view
  return (
    <div onClick={onClick} className="group h-full">
      <Card className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 h-full group-hover:scale-[1.03] group-hover:-translate-y-1 overflow-hidden p-0">
        {/* Enhanced Recipe Image - Edge to Edge */}
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              loading="lazy"
              onError={(e) => {
                // Hide broken images gracefully
                e.currentTarget.style.display = "none";
              }}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
              <ChefHat className="h-16 w-16 text-slate-400 dark:text-slate-500" />
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Family Consensus Badge */}
          {familyConsensus && (
            <div className="absolute top-2 right-2">
              <Badge
                variant={familyConsensus === "love" ? "default" : "secondary"}
                className="text-xs shadow-lg backdrop-blur-sm"
              >
                {familyConsensus === "love" && (
                  <Star className="h-3 w-3 mr-1" />
                )}
                {familyConsensus}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-[10px]">
          {/* Enhanced Title with Actions */}
          <div className="mb-2">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="font-bold text-base text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200 leading-tight flex-1 min-w-0" title={recipe.title}>
                {displayTitle}
              </h3>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(recipe);
                    }}
                    className="h-6 w-6 p-0 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                  >
                    <Edit className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(recipe.id);
                    }}
                    className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                  </Button>
                )}
              </div>
            </div>
            {recipe.description && (
              <div
                className="relative"
                onMouseEnter={handleDescMouseEnter}
                onMouseLeave={handleDescMouseLeave}
              >
                <p className="text-slate-600 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed cursor-help mb-2">
                  {recipe.description}
                </p>
                {showDescTooltip && (
                  <div className="absolute left-0 top-full mt-1 z-[100] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs whitespace-normal break-words">
                    {recipe.description}
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enhanced Recipe Meta */}
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            {totalTime > 0 && (
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 bg-primary-100 dark:bg-primary-900/30 rounded flex items-center justify-center">
                  <Clock className="h-2.5 w-2.5 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="text-xs font-medium">{totalTime}m</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 bg-secondary-100 dark:bg-secondary-900/30 rounded flex items-center justify-center">
                  <Users className="h-2.5 w-2.5 text-secondary-600 dark:text-secondary-400" />
                </div>
                <span className="text-xs font-medium">{recipe.servings}</span>
              </div>
            )}
            {recipe.difficulty && (
              <Badge
                variant="outline"
                className={`text-xs font-medium px-1.5 py-0.5 ${getDifficultyColor(
                  recipe.difficulty
                )} border-0`}
              >
                {recipe.difficulty}
              </Badge>
            )}
            {recipe.rating && (
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded flex items-center justify-center">
                  <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                </div>
                <span className="text-xs font-medium">
                  {recipe.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Enhanced Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <div
                ref={tagsRef}
                className="relative"
                onMouseEnter={() => handleTagsMouseEnter(tagsRef)}
                onMouseLeave={handleTagsMouseLeave}
              >
                <div className="flex gap-1 cursor-help">
                  {recipe.tags.slice(0, 3).map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {recipe.tags.length > 3 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      +{recipe.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
              {recipe.tags && recipe.tags.length > 3 && showTagsTooltip && (
                <div 
                  className="fixed z-[9999] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs whitespace-normal"
                  style={{
                    top: `${tagsTooltipPosition.top}px`,
                    left: `${tagsTooltipPosition.left}px`,
                  }}
                >
                  <div className="font-semibold mb-1">All Tags:</div>
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 dark:bg-slate-100 rotate-45"></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
