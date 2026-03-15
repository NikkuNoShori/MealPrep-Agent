import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMealPlans, useUpdateMealPlan } from '@/services/api';
import {
  CalendarPlus,
  Coffee,
  Sun,
  Moon,
  Cookie,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { MealSlot, PlannedMealEntry } from '@/types/mealPlan';

const DAILY_SLOTS: { key: MealSlot; label: string; icon: React.ElementType }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee },
  { key: 'lunch', label: 'Lunch', icon: Sun },
  { key: 'dinner', label: 'Dinner', icon: Moon },
];

interface AddToPlanButtonProps {
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  size?: 'sm' | 'default';
  compact?: boolean; // icon-only mode for card hover
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

const AddToPlanButton = ({
  recipeId,
  recipeName,
  recipeImage,
  servings = 4,
  prepTime,
  cookTime,
  size = 'sm',
  compact = false,
}: AddToPlanButtonProps) => {
  const [open, setOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const { data: mealPlans } = useMealPlans();
  const updateMealPlan = useUpdateMealPlan();

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentWeekStart = getWeekStart(new Date());
  const targetWeekStart = new Date(currentWeekStart);
  targetWeekStart.setDate(targetWeekStart.getDate() + weekOffset * 7);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(targetWeekStart);
    d.setDate(targetWeekStart.getDate() + i);
    return d;
  });

  // Find plan for the target week
  const weekStartStr = formatDateKey(targetWeekStart);
  const weekEndStr = formatDateKey(weekDates[6]);
  const targetPlan = mealPlans?.find(
    (p: any) => p.status !== 'archived' && p.startDate <= weekEndStr && p.endDate >= weekStartStr
  );

  const handleAdd = (date: Date, slot: MealSlot) => {
    if (!targetPlan) {
      toast.error('No meal plan for this week. Create one first.');
      return;
    }

    const dateStr = formatDateKey(date);
    const currentMeals = { ...(targetPlan.meals || {}) };
    const dayMeals = { ...(currentMeals[dateStr] || {}) };
    const slotMeals = [...(dayMeals[slot] || [])];

    const entry: PlannedMealEntry = {
      id: crypto.randomUUID(),
      recipeId,
      recipeName,
      recipeImage,
      servings,
      prepTime,
      cookTime,
    };

    slotMeals.push(entry);
    dayMeals[slot] = slotMeals;
    currentMeals[dateStr] = dayMeals;

    updateMealPlan.mutate(
      { id: targetPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => {
          toast.success(`Added to ${date.toLocaleDateString('en-US', { weekday: 'short' })} ${slot}`);
          setOpen(false);
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to add'),
      }
    );
  };

  const handleAddToSnacks = () => {
    if (!targetPlan) {
      toast.error('No meal plan for this week. Create one first.');
      return;
    }

    const currentMeals = { ...(targetPlan.meals || {}) };
    const snackItems = [...(currentMeals['_snacks'] || []) as PlannedMealEntry[]];

    const entry: PlannedMealEntry = {
      id: crypto.randomUUID(),
      recipeId,
      recipeName,
      recipeImage,
      servings,
      prepTime,
      cookTime,
    };

    snackItems.push(entry);
    currentMeals['_snacks'] = snackItems;

    updateMealPlan.mutate(
      { id: targetPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => {
          toast.success(`Added to snacks`);
          setOpen(false);
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to add'),
      }
    );
  };

  const weekLabel = `${targetWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <div className="relative" ref={ref}>
      {compact ? (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="w-7 h-7 rounded-lg bg-white/90 dark:bg-white/10 backdrop-blur-md shadow-sm flex items-center justify-center hover:text-[#1D9E75] hover:scale-110 active:scale-95 transition-all duration-150"
          title="Add to Meal Plan"
        >
          <CalendarPlus className="h-3.5 w-3.5 text-stone-600 dark:text-stone-300" />
        </button>
      ) : (
        <Button
          variant="outline"
          size={size}
          className="gap-1.5 rounded-xl"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setOpen(!open); }}
        >
          <CalendarPlus className="h-4 w-4" />
          {size !== 'sm' && 'Add to Plan'}
        </Button>
      )}

      {open && (
        <div
          className={`absolute top-full mt-2 z-50 w-72 rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-[#16171c] shadow-xl animate-scale-in ${compact ? 'left-0' : 'right-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Week nav */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-stone-100 dark:border-white/[0.06]">
            <button
              className="p-1 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors"
              onClick={() => setWeekOffset(weekOffset - 1)}
            >
              <ChevronLeft className="h-4 w-4 text-stone-500" />
            </button>
            <span className="text-xs font-medium text-stone-600 dark:text-gray-400">
              {weekLabel}
            </span>
            <button
              className="p-1 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors"
              onClick={() => setWeekOffset(weekOffset + 1)}
            >
              <ChevronRight className="h-4 w-4 text-stone-500" />
            </button>
          </div>

          {!targetPlan && (
            <div className="px-3 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-b border-stone-100 dark:border-white/[0.06]">
              No plan for this week
            </div>
          )}

          {/* Day + slot grid */}
          <div className="p-2 max-h-64 overflow-y-auto">
            {weekDates.map((date) => {
              const isToday = formatDateKey(date) === formatDateKey(new Date());
              return (
                <div key={formatDateKey(date)} className="mb-1.5 last:mb-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 ${
                    isToday ? 'text-[#1D9E75]' : 'text-stone-400 dark:text-gray-500'
                  }`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {isToday && <span className="ml-1 text-[#1D9E75]">· today</span>}
                  </p>
                  <div className="grid grid-cols-3 gap-1 px-1">
                    {DAILY_SLOTS.map((slot) => (
                      <button
                        key={slot.key}
                        className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-stone-500 dark:text-gray-400 hover:text-[#1D9E75] dark:hover:text-[#34d399] transition-all duration-150 disabled:opacity-30"
                        onClick={() => handleAdd(date, slot.key)}
                        disabled={!targetPlan || updateMealPlan.isPending}
                        title={`Add to ${slot.label}`}
                      >
                        {updateMealPlan.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <slot.icon className="h-3.5 w-3.5" />
                        )}
                        <span className="text-[9px]">{slot.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Snacks (plan-level) */}
            <div className="px-2 pt-1 pb-1 border-t border-stone-100 dark:border-white/[0.06]">
              <button
                className="w-full flex items-center gap-2 py-2 px-2 rounded-lg text-stone-500 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-all duration-150 disabled:opacity-30"
                onClick={handleAddToSnacks}
                disabled={!targetPlan || updateMealPlan.isPending}
              >
                <Cookie className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Add to Snacks</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddToPlanButton;
