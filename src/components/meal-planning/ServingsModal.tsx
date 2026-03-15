import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Minus,
  Plus,
  Check,
  Users,
  ChefHat,
  X,
} from 'lucide-react';
import RecipeImage from './RecipeImage';
import type { SelectedRecipeInfo } from './recipeTypes';

interface ServingsModalProps {
  open: boolean;
  recipes: SelectedRecipeInfo[];
  onConfirm: (recipes: SelectedRecipeInfo[]) => void;
  onClose: () => void;
}

type Phase = 'ask' | 'adjust';

const ServingsModal = ({ open, recipes, onConfirm, onClose }: ServingsModalProps) => {
  const [phase, setPhase] = useState<Phase>('ask');
  const [servingsMap, setServingsMap] = useState<Map<string, number>>(new Map());
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase('ask');
      const initial = new Map<string, number>();
      for (const r of recipes) {
        initial.set(r.recipeId, r.servings);
      }
      setServingsMap(initial);
    }
  }, [open, recipes]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSkip = () => {
    onConfirm(recipes);
  };

  const handleConfirmServings = () => {
    const updated = recipes.map((r) => ({
      ...r,
      servings: servingsMap.get(r.recipeId) || r.servings,
    }));
    onConfirm(updated);
  };

  const updateServings = (recipeId: string, delta: number) => {
    setServingsMap((prev) => {
      const next = new Map(prev);
      const current = next.get(recipeId) || 4;
      next.set(recipeId, Math.max(1, current + delta));
      return next;
    });
  };

  if (!open || recipes.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {phase === 'ask' ? (
        /* ── Phase 1: Ask whether to modify servings ── */
        <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-white/[0.08] overflow-hidden animate-scale-in">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 mb-4">
              <Users className="h-7 w-7 text-primary/70" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
              Modify serving sizes?
            </h3>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">
              You selected {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}. Would you like to adjust serving sizes before adding?
            </p>

            {/* Recipe preview chips */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {recipes.slice(0, 5).map((r) => (
                <div
                  key={r.recipeId}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-xs text-stone-600 dark:text-gray-300"
                >
                  <ChefHat className="h-3 w-3 text-stone-400" />
                  <span className="truncate max-w-[120px]">{r.recipeName}</span>
                </div>
              ))}
              {recipes.length > 5 && (
                <div className="flex items-center px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-xs text-stone-400">
                  +{recipes.length - 5} more
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 px-6 pb-6">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-10 hover:shadow-md transition-all duration-200"
              onClick={handleSkip}
            >
              No, use defaults
            </Button>
            <Button
              className="flex-1 rounded-xl h-10 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
              onClick={() => setPhase('adjust')}
            >
              Yes, adjust servings
            </Button>
          </div>
        </div>
      ) : (
        /* ── Phase 2: Adjust servings per recipe ── */
        <div className="w-full max-w-lg max-h-[80vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-white/[0.08] flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-white/[0.06]">
            <div>
              <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                Adjust Servings
              </h3>
              <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
                Set serving sizes for each recipe
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

          {/* Recipe list with servings controls */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {recipes.map((recipe) => {
              const currentServings = servingsMap.get(recipe.recipeId) || recipe.servings;
              return (
                <div
                  key={recipe.recipeId}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-stone-200/60 dark:border-white/[0.06] bg-stone-50/50 dark:bg-white/[0.02] hover:bg-stone-50 dark:hover:bg-white/[0.04] hover:shadow-md hover:border-stone-300/60 dark:hover:border-white/[0.1] transition-all duration-200"
                >
                  <RecipeImage src={recipe.recipeImage} alt={recipe.recipeName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-gray-200 truncate">
                      {recipe.recipeName}
                    </p>
                    <p className="text-[10px] text-stone-400 dark:text-gray-500 mt-0.5">
                      Default: {recipe.servings} servings
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      className="w-7 h-7 rounded-lg border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] flex items-center justify-center text-stone-500 hover:text-primary hover:border-primary/30 hover:shadow-sm active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:hover:text-stone-500"
                      onClick={() => updateServings(recipe.recipeId, -1)}
                      disabled={currentServings <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold text-stone-900 dark:text-white w-7 text-center tabular-nums">
                      {currentServings}
                    </span>
                    <button
                      className="w-7 h-7 rounded-lg border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] flex items-center justify-center text-stone-500 hover:text-primary hover:border-primary/30 hover:shadow-sm active:scale-95 transition-all duration-150"
                      onClick={() => updateServings(recipe.recipeId, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-stone-200/60 dark:border-white/[0.06] flex items-center justify-between bg-stone-50/50 dark:bg-white/[0.02]">
            <button
              className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-gray-300 transition-colors"
              onClick={() => setPhase('ask')}
            >
              ← Back
            </button>
            <Button
              size="sm"
              className="gap-1.5 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              onClick={handleConfirmServings}
            >
              <Check className="h-3.5 w-3.5" />
              Add {recipes.length} {recipes.length === 1 ? 'Recipe' : 'Recipes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServingsModal;
