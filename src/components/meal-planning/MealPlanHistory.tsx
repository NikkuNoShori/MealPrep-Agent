import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock,
  CheckCircle2,
  Archive,
  Copy,
  MoreHorizontal,
  Trash2,
  Loader2,
  ChefHat,
  ShoppingCart,
  X,
} from 'lucide-react';
import type { MealPlan, MealPlanStatus } from '@/types/mealPlan';

const STATUS_CONFIG: Record<MealPlanStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-100 dark:bg-white/[0.04]' },
  active: { label: 'Active', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-500/10' },
  completed: { label: 'Done', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-500/10' },
  archived: { label: 'Archived', color: 'text-stone-500 dark:text-stone-500', bg: 'bg-stone-100 dark:bg-stone-800' },
};

function countMeals(meals: MealPlan['meals'] | undefined): number {
  if (!meals) return 0;
  return Object.entries(meals).reduce((sum, [key, val]) => {
    if (!val) return sum;
    if (key.startsWith('_') && Array.isArray(val)) return sum + val.length;
    if (typeof val === 'object' && !Array.isArray(val)) {
      const day = val as Record<string, unknown[]>;
      return sum +
        (day.breakfast?.length || 0) +
        (day.lunch?.length || 0) +
        (day.dinner?.length || 0) +
        (day.snacks?.length || 0);
    }
    return sum;
  }, 0);
}

function formatDateRange(start: string, end: string): string {
  const startFmt = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFmt = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

interface MealPlanHistoryProps {
  plans: MealPlan[];
  isLoading: boolean;
  planMenuOpen: string | null;
  onPlanMenuToggle: (planId: string | null) => void;
  onCopy: (planId: string) => void;
  onStatusChange: (planId: string, status: MealPlanStatus) => void;
  onDelete: (planId: string) => void;
  copyPending?: boolean;
}

const MealPlanHistory = ({
  plans,
  isLoading,
  planMenuOpen,
  onPlanMenuToggle,
  onCopy,
  onStatusChange,
  onDelete,
  copyPending,
}: MealPlanHistoryProps) => {
  const [detailPlan, setDetailPlan] = useState<MealPlan | null>(null);

  useEffect(() => {
    if (!detailPlan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailPlan(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailPlan]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500/50" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-10 w-10 text-stone-300 dark:text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-stone-800 dark:text-gray-200 mb-1">
          No history yet
        </h3>
        <p className="text-sm text-stone-500 dark:text-gray-400">
          Completed and archived plans will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {plans.map((plan) => {
          const statusCfg = STATUS_CONFIG[plan.status] || STATUS_CONFIG.completed;
          const mealCount = countMeals(plan.meals);
          const groceryCount = plan.groceryList?.items?.filter((i) => !i.isRemoved).length || 0;

          return (
            <div
              key={plan.id}
              className="group flex items-center justify-between p-4 rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:shadow-md hover:-translate-y-px transition-all duration-300 cursor-pointer"
              onClick={() => setDetailPlan(plan)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${statusCfg.bg} transition-colors`}>
                  {plan.status === 'completed' ? (
                    <CheckCircle2 className={`h-5 w-5 ${statusCfg.color}`} />
                  ) : (
                    <Archive className={`h-5 w-5 ${statusCfg.color}`} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800 dark:text-gray-200">
                    {plan.title || 'Untitled Plan'}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
                    {formatDateRange(plan.startDate, plan.endDate)}
                    <span className="mx-1.5 text-stone-300 dark:text-gray-600">|</span>
                    {mealCount} meals
                    {groceryCount > 0 && (
                      <>
                        <span className="mx-1.5 text-stone-300 dark:text-gray-600">|</span>
                        {groceryCount} grocery items
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl text-xs hover:shadow-md transition-all duration-200"
                  onClick={() => onCopy(plan.id)}
                  disabled={copyPending}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl"
                    onClick={() => onPlanMenuToggle(planMenuOpen === plan.id ? null : plan.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {planMenuOpen === plan.id && (
                    <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-[#16171c] p-1.5 shadow-xl animate-scale-in">
                      {plan.status === 'archived' && (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                          onClick={() => onStatusChange(plan.id, 'completed')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Restore
                        </button>
                      )}
                      {plan.status !== 'archived' && (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                          onClick={() => onStatusChange(plan.id, 'archived')}
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </button>
                      )}
                      <div className="my-1 border-t border-stone-100 dark:border-white/[0.06]" />
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                        onClick={() => onDelete(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Read-only detail overlay */}
      {detailPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailPlan(null)}
        >
        <div onClick={(e) => e.stopPropagation()}>
          <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden border-stone-200/80 dark:border-white/[0.08] shadow-2xl">
            <CardContent className="p-5 overflow-y-auto max-h-[80vh]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white flex items-center gap-2 flex-wrap">
                    {detailPlan.title || 'Untitled Plan'}
                    <Badge variant="secondary" className="text-xs">
                      {STATUS_CONFIG[detailPlan.status]?.label || detailPlan.status}
                    </Badge>
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
                    {formatDateRange(detailPlan.startDate, detailPlan.endDate)}
                  </p>
                </div>
                <button
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white transition-colors"
                  onClick={() => setDetailPlan(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                    <ChefHat className="h-3.5 w-3.5" />
                    Meals ({countMeals(detailPlan.meals)})
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {Object.entries(detailPlan.meals || {}).flatMap(([key, val]) => {
                      if (!val) return [];
                      if (key.startsWith('_') && Array.isArray(val)) {
                        return val.map((entry: { id: string; recipeName: string }) => (
                          <p key={entry.id} className="text-sm text-stone-700 dark:text-gray-300 px-2 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04]">
                            {key === '_snacks' ? 'Snack: ' : ''}{entry.recipeName}
                          </p>
                        ));
                      }
                      if (typeof val === 'object' && !Array.isArray(val)) {
                        const day = val as Record<string, { id: string; recipeName: string }[]>;
                        return Object.entries(day).flatMap(([slot, meals]) =>
                          (meals || []).map((entry) => (
                            <p key={entry.id} className="text-sm text-stone-700 dark:text-gray-300 px-2 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04]">
                              {key} {slot}: {entry.recipeName}
                            </p>
                          ))
                        );
                      }
                      return [];
                    })}
                    {countMeals(detailPlan.meals) === 0 && (
                      <p className="text-sm text-stone-400 dark:text-gray-500">No meals recorded.</p>
                    )}
                  </div>
                </div>

                {detailPlan.groceryList?.items && detailPlan.groceryList.items.filter((i) => !i.isRemoved).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Grocery List
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {detailPlan.groceryList.items
                        .filter((i) => !i.isRemoved)
                        .map((item) => (
                          <p
                            key={item.id}
                            className={`text-sm px-2 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04] ${
                              item.isChecked
                                ? 'line-through text-stone-400 dark:text-gray-500'
                                : 'text-stone-700 dark:text-gray-300'
                            }`}
                          >
                            {item.amount !== null && `${item.amount} `}
                            {item.unit && `${item.unit} `}
                            {item.name}
                          </p>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-white/[0.06]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      onCopy(detailPlan.id);
                      setDetailPlan(null);
                    }}
                    disabled={copyPending}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy to Current Week
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      )}
    </>
  );
};

export default MealPlanHistory;
