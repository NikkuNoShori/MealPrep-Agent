import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Coffee,
  Sun,
  Moon,
  Cookie,
  X,
  Check,
  Calendar,
} from 'lucide-react';
import RecipeImage from './RecipeImage';
import type { SelectedRecipeInfo } from './recipeTypes';
import type { MealSlot } from '@/types/mealPlan';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RecipeAssignment {
  recipe: SelectedRecipeInfo;
  slot: MealSlot;
  /** ISO date strings. Empty = unassigned (will use defaultDate). */
  dates: string[];
}

interface DayAssignmentModalProps {
  open: boolean;
  recipes: SelectedRecipeInfo[];
  weekDates: Date[];
  defaultDate: string;
  defaultSlot: MealSlot;
  onConfirm: (assignments: RecipeAssignment[]) => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SLOT_CONFIG: { key: MealSlot; label: string; icon: React.ElementType; color: string; bg: string; activeBg: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-500', bg: 'bg-amber-500/10', activeBg: 'bg-amber-500' },
  { key: 'lunch', label: 'Lunch', icon: Sun, color: 'text-orange-500', bg: 'bg-orange-500/10', activeBg: 'bg-orange-500' },
  { key: 'dinner', label: 'Dinner', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-500/10', activeBg: 'bg-indigo-500' },
  { key: 'snacks', label: 'Snacks', icon: Cookie, color: 'text-pink-500', bg: 'bg-pink-500/10', activeBg: 'bg-pink-500' },
];

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DayAssignmentModal = ({
  open,
  recipes,
  weekDates,
  defaultDate,
  defaultSlot,
  onConfirm,
  onClose,
}: DayAssignmentModalProps) => {
  // Map: recipeId → { slot | null, dates }
  const [assignments, setAssignments] = useState<Map<string, { slot: MealSlot | null; dates: string[] }>>(new Map());
  const [showDays, setShowDays] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialize — no slot pre-selected, default date pre-selected
  useEffect(() => {
    if (!open || recipes.length === 0) return;
    const initial = new Map<string, { slot: MealSlot | null; dates: string[] }>();
    for (const r of recipes) {
      initial.set(r.recipeId, { slot: null, dates: [defaultDate] });
    }
    setAssignments(initial);
    setShowDays(false);
  }, [open, recipes, defaultDate]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const updateSlot = useCallback((recipeId: string, slot: MealSlot) => {
    setAssignments(prev => {
      const next = new Map(prev);
      const current = next.get(recipeId);
      if (current) {
        const currentSlot = current.slot;
        // Toggle off if clicking same slot
        if (currentSlot === slot) {
          next.set(recipeId, { slot: null, dates: current.dates });
        } else {
          // If moving to snacks, clear dates since snacks are plan-level
          const dates = slot === 'snacks' ? [] : (current.dates.length > 0 ? current.dates : [defaultDate]);
          next.set(recipeId, { slot, dates });
        }
      }
      return next;
    });
  }, [defaultDate]);

  const toggleDate = useCallback((recipeId: string, dateStr: string) => {
    setAssignments(prev => {
      const next = new Map(prev);
      const current = next.get(recipeId);
      if (current) {
        const dates = current.dates.includes(dateStr)
          ? current.dates.filter(d => d !== dateStr)
          : [...current.dates, dateStr];
        // Ensure at least one date stays selected
        if (dates.length === 0) return prev;
        next.set(recipeId, { ...current, dates });
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const result: RecipeAssignment[] = [];
    for (const recipe of recipes) {
      const assignment = assignments.get(recipe.recipeId);
      if (assignment && assignment.slot) {
        result.push({
          recipe,
          slot: assignment.slot,
          dates: assignment.dates,
        });
      }
    }
    onConfirm(result);
  }, [recipes, assignments, onConfirm]);

  if (!open || recipes.length === 0) return null;

  // Count how many have a slot assigned
  const assignedCount = Array.from(assignments.values()).filter(a => a.slot !== null).length;
  const allAssigned = assignedCount === recipes.length;
  const todayStr = formatDateKey(new Date());

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg max-h-[85vh] mx-4 bg-white dark:bg-[#16171c] rounded-2xl shadow-2xl border border-stone-200/60 dark:border-white/[0.08] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-white/[0.06]">
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
              Assign to Plan
            </h3>
            <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
              Choose a meal type for each recipe
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Recipe list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {recipes.map(recipe => {
            const assignment = assignments.get(recipe.recipeId);
            const currentSlot = assignment?.slot || null;
            const dates = assignment?.dates || [];

            return (
              <div
                key={recipe.recipeId}
                className="rounded-xl border border-stone-200/60 dark:border-white/[0.06] bg-stone-50/50 dark:bg-white/[0.02] overflow-hidden transition-all duration-200 hover:border-stone-300/60 dark:hover:border-white/[0.1]"
              >
                {/* Recipe info + slot buttons */}
                <div className="flex items-center gap-3 p-3">
                  <RecipeImage src={recipe.recipeImage} alt={recipe.recipeName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-gray-200 truncate">
                      {recipe.recipeName}
                    </p>
                    <p className="text-[10px] text-stone-400 dark:text-gray-500 mt-0.5">
                      {recipe.servings} servings
                    </p>
                  </div>
                </div>

                {/* Slot selection buttons */}
                <div className="flex items-center gap-1.5 px-3 pb-3">
                  {SLOT_CONFIG.map(slot => {
                    const isActive = currentSlot === slot.key;
                    return (
                      <button
                        key={slot.key}
                        onClick={() => updateSlot(recipe.recipeId, slot.key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 ${
                          isActive
                            ? `${slot.activeBg} text-white shadow-sm`
                            : `${slot.bg} ${slot.color} hover:opacity-80`
                        }`}
                      >
                        <slot.icon className="h-3 w-3" />
                        {slot.label}
                      </button>
                    );
                  })}
                </div>

                {/* Day chips (when Days toggle is on and slot is not snacks) */}
                {showDays && currentSlot && currentSlot !== 'snacks' && (
                  <div className="flex items-center gap-1 px-3 pb-3 pt-0.5 border-t border-stone-100 dark:border-white/[0.04]">
                    {weekDates.map(date => {
                      const dateStr = formatDateKey(date);
                      const isSelected = dates.includes(dateStr);
                      const isToday = dateStr === todayStr;
                      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'narrow' });
                      const dayNum = date.getDate();

                      return (
                        <button
                          key={dateStr}
                          onClick={() => toggleDate(recipe.recipeId, dateStr)}
                          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-lg text-[10px] transition-all duration-150 min-w-[32px] ${
                            isSelected
                              ? 'bg-primary-500 text-white shadow-sm'
                              : isToday
                                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20'
                                : 'text-stone-400 dark:text-gray-500 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
                          }`}
                          title={date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        >
                          <span className="font-semibold leading-none">{dayLabel}</span>
                          <span className="leading-none">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-200/60 dark:border-white/[0.06] flex items-center justify-between bg-stone-50/50 dark:bg-white/[0.02]">
          {/* Days toggle */}
          <button
            onClick={() => setShowDays(!showDays)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              showDays
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Days
            <div className={`w-7 h-4 rounded-full transition-all duration-200 relative ${
              showDays ? 'bg-primary-500' : 'bg-stone-300 dark:bg-gray-600'
            }`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${
                showDays ? 'left-3.5' : 'left-0.5'
              }`} />
            </div>
          </button>

          <div className="flex items-center gap-3">
            {!allAssigned && (
              <span className="text-[10px] text-amber-500">
                {recipes.length - assignedCount} unassigned
              </span>
            )}
            <Button
              size="sm"
              disabled={assignedCount === 0}
              className="gap-1.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0"
              onClick={handleConfirm}
            >
              <Check className="h-3.5 w-3.5" />
              Add {assignedCount > 0 ? assignedCount : ''} to Plan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayAssignmentModal;
