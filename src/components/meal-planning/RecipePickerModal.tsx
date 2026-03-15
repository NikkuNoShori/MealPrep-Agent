import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRecipes } from '@/services/api';
import {
  X,
  Search,
  Clock,
  Users,
  ChefHat,
  Minus,
  Plus,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react';
import type { MealSlot } from '@/types/mealPlan';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

interface RecipePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (recipe: { recipeId: string; recipeName: string; recipeImage?: string; servings: number; prepTime?: number; cookTime?: number }) => void;
  date: string; // ISO date string for display
  slot: MealSlot;
}

const RecipePickerModal = ({ open, onClose, onSelect, date, slot }: RecipePickerModalProps) => {
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [servings, setServings] = useState(4);
  const searchRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { data: recipesData, isLoading } = useRecipes({ limit: 200 });

  const recipes = useMemo(() => {
    const list = (recipesData as any)?.recipes || recipesData || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r: any) =>
      r.title?.toLowerCase().includes(q) ||
      r.tags?.some((t: string) => t.toLowerCase().includes(q)) ||
      r.cuisine?.toLowerCase().includes(q)
    );
  }, [recipesData, search]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedRecipe(null);
      setServings(4);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleConfirm = () => {
    if (!selectedRecipe) return;
    onSelect({
      recipeId: selectedRecipe.id,
      recipeName: selectedRecipe.title,
      recipeImage: selectedRecipe.imageUrl,
      servings,
      prepTime: selectedRecipe.prepTime ? parseInt(selectedRecipe.prepTime) : undefined,
      cookTime: selectedRecipe.cookTime ? parseInt(selectedRecipe.cookTime) : undefined,
    });
    onClose();
  };

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-white/[0.08] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-white/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
              Add Recipe
            </h2>
            <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
              {dateLabel} · {SLOT_LABELS[slot]}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-xl"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-stone-100 dark:border-white/[0.04]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search recipes by name, tag, or cuisine..."
              className="pl-10 h-10 rounded-xl"
            />
          </div>
        </div>

        {/* Recipe List or Selection Detail */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedRecipe ? (
            /* Selected recipe detail */
            <div className="p-5 space-y-4 animate-fade-in">
              <button
                className="text-xs text-primary hover:text-primary/80 transition-colors"
                onClick={() => setSelectedRecipe(null)}
              >
                ← Back to recipes
              </button>

              <div className="flex gap-4">
                {selectedRecipe.imageUrl ? (
                  <img
                    src={selectedRecipe.imageUrl}
                    alt={selectedRecipe.title}
                    className="w-28 h-28 rounded-xl object-cover shadow-md"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-stone-100 to-stone-50 dark:from-white/[0.06] dark:to-white/[0.02] flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-stone-300 dark:text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white truncate">
                    {selectedRecipe.title}
                  </h3>
                  {selectedRecipe.description && (
                    <p className="text-sm text-stone-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {selectedRecipe.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {selectedRecipe.prepTime && (
                      <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {selectedRecipe.prepTime}m prep
                      </span>
                    )}
                    {selectedRecipe.cookTime && (
                      <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {selectedRecipe.cookTime}m cook
                      </span>
                    )}
                    {selectedRecipe.difficulty && (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {selectedRecipe.difficulty}
                      </Badge>
                    )}
                  </div>
                  {selectedRecipe.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selectedRecipe.tags.slice(0, 5).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Servings control */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/[0.06]">
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-gray-300">
                    Servings
                  </p>
                  <p className="text-xs text-stone-400 dark:text-gray-500">
                    Recipe default: {selectedRecipe.servings || 4}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => setServings(Math.max(1, servings - 1))}
                    disabled={servings <= 1}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-lg font-semibold text-stone-900 dark:text-white w-8 text-center">
                    {servings}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={() => setServings(servings + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Recipe list */
            <div className="p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                </div>
              ) : recipes.length === 0 ? (
                <div className="text-center py-12">
                  <ChefHat className="h-10 w-10 text-stone-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-stone-600 dark:text-gray-300">
                    {search ? 'No recipes match your search' : 'No recipes yet'}
                  </p>
                  <p className="text-xs text-stone-400 dark:text-gray-500 mt-1">
                    {search ? 'Try a different search term' : 'Add recipes from the Recipes page first'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recipes.map((recipe: any) => (
                    <button
                      key={recipe.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-all duration-200 group"
                      onClick={() => {
                        setSelectedRecipe(recipe);
                        setServings(recipe.servings || 4);
                      }}
                    >
                      {recipe.imageUrl ? (
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          className="w-12 h-12 rounded-lg object-cover shadow-sm group-hover:shadow-md transition-shadow"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-stone-100 to-stone-50 dark:from-white/[0.06] dark:to-white/[0.02] flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed className="h-5 w-5 text-stone-300 dark:text-gray-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 dark:text-gray-200 truncate group-hover:text-primary transition-colors">
                          {recipe.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {recipe.prepTime && (
                            <span className="flex items-center gap-0.5 text-[11px] text-stone-400 dark:text-gray-500">
                              <Clock className="h-3 w-3" />
                              {recipe.prepTime}m
                            </span>
                          )}
                          {recipe.servings && (
                            <span className="flex items-center gap-0.5 text-[11px] text-stone-400 dark:text-gray-500">
                              <Users className="h-3 w-3" />
                              {recipe.servings}
                            </span>
                          )}
                          {recipe.difficulty && (
                            <Badge variant="secondary" className="text-[9px] uppercase h-4 px-1">
                              {recipe.difficulty}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-stone-300 dark:text-gray-600 group-hover:text-primary transition-colors">
                        Select →
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedRecipe && (
          <div className="px-5 py-4 border-t border-stone-200/60 dark:border-white/[0.06] flex items-center justify-between bg-stone-50/50 dark:bg-white/[0.02]">
            <p className="text-sm text-stone-500 dark:text-gray-400">
              Adding <span className="font-medium text-stone-700 dark:text-gray-300">{selectedRecipe.title}</span> to {SLOT_LABELS[slot]}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedRecipe(null)}>
                Back
              </Button>
              <Button
                size="sm"
                className="gap-1.5 rounded-xl shadow-lg shadow-primary/20"
                onClick={handleConfirm}
              >
                <Plus className="h-3.5 w-3.5" />
                Add to Plan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipePickerModal;
