import React, { useState, useEffect, useRef } from 'react'
import { useMemo } from 'react'
import { useRecipes, useDeleteRecipe, useRemoveRecipeFromCollection, useCollectionRecipes, usePublicRecipes, useHouseholdRecipes, useRecipeReactions, useToggleRecipeReaction, useMyHousehold, useRecipeTextSearch, useMyCollections, useBulkDeleteRecipes, useBulkUpdateRecipeVisibility, useBulkAddToCollection } from '@/services/api'
import { RecipeCard, RecipeReaction } from './RecipeCard'
import { RecipeSearch } from './RecipeSearch'
import { useAuthStore } from '@/stores/authStore'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Grid, List, X, Trash2, Eye, FolderOpen, ChevronDown } from "lucide-react";
import toast from 'react-hot-toast';

const MAX_SELECTION = 100;

interface RecipeListProps {
  onRecipeSelect?: (recipe: any) => void;
  onAddRecipe?: () => void;
  onEditRecipe?: (recipe: any) => void;
  collectionId?: string | null;
  collectionName?: string | null;
  feedMode?: 'public' | 'mine' | 'household' | 'collection';
}

export const RecipeList: React.FC<RecipeListProps> = ({
  onRecipeSelect,
  onAddRecipe,
  onEditRecipe,
  collectionId,
  collectionName: _collectionName,
  feedMode = 'mine',
}) => {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const [filters, setFilters] = useState({
    dietaryRestrictions: [] as string[],
    prepTime: "" as string,
    difficulty: "" as string,
    tags: [] as string[],
  });

  // ── Multi-select state ──
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showVisibilityPopover, setShowVisibilityPopover] = useState(false);
  const [showFolderPopover, setShowFolderPopover] = useState(false);
  const visibilityRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);

  const bulkDelete = useBulkDeleteRecipes();
  const bulkVisibility = useBulkUpdateRecipeVisibility();
  const bulkAddToCollection = useBulkAddToCollection();
  const { data: collectionsData } = useMyCollections();
  const collections: any[] = (collectionsData as any) || [];

  // Exit select mode on feed change
  useEffect(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, [feedMode, collectionId]);

  // Close popovers on outside click
  useEffect(() => {
    if (!showVisibilityPopover && !showFolderPopover) return;
    const handler = (e: MouseEvent) => {
      if (visibilityRef.current && !visibilityRef.current.contains(e.target as Node)) {
        setShowVisibilityPopover(false);
      }
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) {
        setShowFolderPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVisibilityPopover, showFolderPopover]);

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
    setShowVisibilityPopover(false);
    setShowFolderPopover(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelectMode(false);
      } else {
        if (next.size >= MAX_SELECTION) {
          toast.error(`You can select at most ${MAX_SELECTION} recipes at once.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const enterSelectMode = (id: string) => {
    setIsSelectMode(true);
    setSelectedIds(new Set([id]));
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} recipe${count === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      toast.success(`Deleted ${count} recipe${count === 1 ? '' : 's'}.`);
      exitSelectMode();
    } catch {
      toast.error('Failed to delete recipes. Please try again.');
    }
  };

  const handleBulkVisibility = async (visibility: 'private' | 'household' | 'public') => {
    setShowVisibilityPopover(false);
    try {
      await bulkVisibility.mutateAsync({ recipeIds: Array.from(selectedIds), visibility });
      toast.success(`Updated ${selectedIds.size} recipe${selectedIds.size === 1 ? '' : 's'} to ${visibility}.`);
      exitSelectMode();
    } catch {
      toast.error('Failed to update visibility. Please try again.');
    }
  };

  const handleBulkAddToCollection = async (targetCollectionId: string, name: string) => {
    setShowFolderPopover(false);
    try {
      const added = await bulkAddToCollection.mutateAsync({ collectionId: targetCollectionId, recipeIds: Array.from(selectedIds) });
      toast.success(`Added ${added} recipe${added === 1 ? '' : 's'} to ${name}.`);
      exitSelectMode();
    } catch {
      toast.error('Failed to add to collection. Please try again.');
    }
  };

  const { data: recipes, isLoading, error } = useRecipes({ limit: 50 });
  const { data: publicRecipesData, isLoading: publicLoading } = usePublicRecipes({ limit: 50 });
  const { data: householdRecipesData } = useHouseholdRecipes({ limit: 50 });
  const { data: collectionRecipes, isLoading: collectionLoading } = useCollectionRecipes(collectionId || '');
  const deleteRecipeMutation = useDeleteRecipe();
  const removeFromCollectionMutation = useRemoveRecipeFromCollection();
  const toggleReaction = useToggleRecipeReaction();
  const { data: householdData } = useMyHousehold();
  const dependents = useMemo(() => {
    if (!householdData) return [];
    return ((householdData as any)?.dependents || []).map((d: any) => ({ id: d.id, name: d.name }));
  }, [householdData]);

  // Determine which recipes to show based on feed mode
  const baseRecipes = feedMode === 'collection' && collectionId
    ? (collectionRecipes || []).map((cr: any) => cr.recipes).filter(Boolean)
    : feedMode === 'household'
    ? (householdRecipesData as any)?.recipes || []
    : feedMode === 'public'
    ? (publicRecipesData as any)?.recipes || []
    : (recipes as any)?.recipes || [];

  const useServerSearch = !!debouncedQuery.trim() && feedMode !== 'collection' && feedMode !== 'household' && feedMode !== 'public';
  const { data: serverSearchResults } = useRecipeTextSearch(useServerSearch ? debouncedQuery : "");
  const recipesAfterSearch = useServerSearch
    ? (serverSearchResults || [])
    : searchQuery
      ? baseRecipes.filter((recipe: any) =>
          recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : baseRecipes;

  const filteredRecipes =
    recipesAfterSearch.filter((recipe: any) => {
      if (filters.dietaryRestrictions.length > 0) {
        const recipeTags = recipe.tags || [];
        if (
          !filters.dietaryRestrictions.some((restriction) =>
            recipeTags.includes(restriction)
          )
        ) {
          return false;
        }
      }

      if (filters.prepTime) {
        const [min, max] = filters.prepTime.split("-").map(Number);
        if (recipe.prepTime < min || recipe.prepTime > max) {
          return false;
        }
      }

      if (filters.difficulty && recipe.difficulty !== filters.difficulty) {
        return false;
      }

      return true;
    });

  const totalCount = filteredRecipes.length;

  // Fetch reactions for all visible recipes
  const recipeIds = useMemo(() => filteredRecipes.map((r: any) => r.id), [filteredRecipes]);
  const { data: allReactions } = useRecipeReactions(recipeIds);

  const reactionsByRecipe = useMemo(() => {
    const map: Record<string, RecipeReaction[]> = {};
    if (allReactions) {
      for (const r of allReactions as RecipeReaction[]) {
        if (!map[r.recipeId]) map[r.recipeId] = [];
        map[r.recipeId].push(r);
      }
    }
    return map;
  }, [allReactions]);

  const handleReact = (recipeId: string, reaction: "thumbs_up" | "thumbs_down", familyMemberId?: string) => {
    toggleReaction.mutate({ recipeId, reaction, familyMemberId });
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (feedMode === 'collection' && collectionId) {
      if (window.confirm("Remove this recipe from the collection?")) {
        try {
          await removeFromCollectionMutation.mutateAsync({ collectionId, recipeId });
        } catch (error) {
          console.error("Failed to remove from collection:", error);
        }
      }
    } else {
      if (
        window.confirm(
          "Are you sure you want to delete this recipe? This action cannot be undone."
        )
      ) {
        try {
          await deleteRecipeMutation.mutateAsync(recipeId);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error("Failed to delete recipe:", errorMessage);
        }
      }
    }
  };

  // Bulk actions are only available in 'mine' feed mode (user owns the recipes)
  const canBulkSelect = feedMode === 'mine';

  if (isLoading || publicLoading || (collectionId && collectionLoading)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-red-600">
            Failed to load recipes. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search, Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {isSelectMode ? (
          /* ── Select mode toolbar ── */
          <div className="flex-1 flex flex-wrap items-center gap-2">
            {/* Unified count — text-swaps to "N of M selected" */}
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200 shrink-0">
              {selectedIds.size} of {totalCount} selected
            </span>

            {/* Visibility button */}
            <div className="relative" ref={visibilityRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowVisibilityPopover(v => !v); setShowFolderPopover(false); }}
                className="rounded-lg flex items-center gap-1.5 text-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                Visibility
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
              {showVisibilityPopover && (
                <div className="absolute top-full left-0 mt-1.5 z-[200] bg-white dark:bg-[#1e1f26] border border-stone-200/60 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 py-1 min-w-[160px] animate-scale-in origin-top-left">
                  {(['private', 'household', 'public'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => handleBulkVisibility(v)}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/[0.05] capitalize transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add to folder button */}
            {collections.length > 0 && (
              <div className="relative" ref={folderRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowFolderPopover(v => !v); setShowVisibilityPopover(false); }}
                  className="rounded-lg flex items-center gap-1.5 text-xs"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Add to folder
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
                {showFolderPopover && (
                  <div className="absolute top-full left-0 mt-1.5 z-[200] bg-white dark:bg-[#1e1f26] border border-stone-200/60 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30 py-1 min-w-[180px] animate-scale-in origin-top-left max-h-48 overflow-y-auto">
                    {collections.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => handleBulkAddToCollection(c.id, c.name)}
                        className="w-full text-left px-3 py-1.5 text-[13px] text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors truncate"
                      >
                        {c.icon && <span className="mr-1.5">{c.icon}</span>}{c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="rounded-lg flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 border-rose-200 hover:border-rose-300 dark:text-rose-400 dark:border-rose-500/30 dark:hover:border-rose-400/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>

            {/* Exit select mode */}
            <button
              onClick={exitSelectMode}
              className="ml-auto p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.06] text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              title="Exit selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* ── Normal toolbar ── */
          <>
            <div className="flex-1 min-w-0">
              <RecipeSearch
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Unified count — "N recipes" in normal mode */}
              {totalCount > 0 && (
                <span className="text-sm text-stone-400 dark:text-stone-500 shrink-0 tabular-nums">
                  {totalCount} {totalCount === 1 ? 'recipe' : 'recipes'}
                </span>
              )}

              {/* View Toggle */}
              <div className="flex items-center bg-stone-100 dark:bg-white/[0.04] rounded-xl p-1 shrink-0">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={`rounded-lg transition-all duration-200 ${
                    viewMode === "grid"
                      ? "bg-white dark:bg-white/[0.08] shadow-sm"
                      : ""
                  }`}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={`rounded-lg transition-all duration-200 ${
                    viewMode === "list"
                      ? "bg-white dark:bg-white/[0.08] shadow-sm"
                      : ""
                  }`}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {onAddRecipe && (
                <Button
                  onClick={onAddRecipe}
                  className="flex-1 sm:flex-none bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Recipe
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Recipe Grid/List with Enhanced Empty State */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-10">
          <div className="max-w-md mx-auto">
            <div className="relative mb-8">
              <div className="w-32 h-32 bg-primary-100 dark:bg-primary-900/30 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                <div className="w-20 h-20 bg-primary-500 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">📖</span>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-sm">✨</span>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-3">
              {searchQuery ||
              Object.values(filters).some((f) => f && f.length > 0)
                ? "No recipes match your search"
                : "Start building your recipe collection"}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-8 text-lg leading-relaxed">
              {searchQuery ||
              Object.values(filters).some((f) => f && f.length > 0)
                ? "Try adjusting your search terms or filters to find what you're looking for."
                : "Add your first recipe to get started with meal planning and cooking inspiration."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {onAddRecipe && (
                <Button
                  onClick={onAddRecipe}
                  size="lg"
                  className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {searchQuery ||
                  Object.values(filters).some((f) => f && f.length > 0)
                    ? "Add New Recipe"
                    : "Add Your First Recipe"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
          }
        >
          {filteredRecipes.map((recipe: any, index: number) => (
            <div
              key={recipe.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <RecipeCard
                recipe={recipe}
                viewMode={viewMode}
                reactions={reactionsByRecipe[recipe.id] || []}
                dependents={dependents}
                onReact={handleReact}
                onClick={isSelectMode ? undefined : () => onRecipeSelect?.(recipe)}
                onEdit={(!isSelectMode && recipe.userId === user?.id) ? onEditRecipe : undefined}
                onDelete={(!isSelectMode && (recipe.userId === user?.id || (feedMode === 'collection' && collectionId))) ? handleDeleteRecipe : undefined}
                isSelected={selectedIds.has(recipe.id)}
                isSelectMode={isSelectMode}
                onSelect={canBulkSelect ? (id: string) => {
                  if (isSelectMode) {
                    toggleSelect(id);
                  } else {
                    enterSelectMode(id);
                  }
                } : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


