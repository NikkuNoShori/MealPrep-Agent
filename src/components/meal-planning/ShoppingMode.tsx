import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_LABELS } from '@/utils/ingredientAggregator';
import type { GroceryItem } from '@/types/mealPlan';

interface ShoppingModeProps {
  grouped: Map<string, GroceryItem[]>;
  onToggleCheck: (itemId: string) => void;
}

/**
 * Simplified in-store grocery view — large checkboxes, category headers,
 * checked items sink to the bottom of each category (MOP-0004 P2).
 */
const ShoppingMode = ({ grouped, onToggleCheck }: ShoppingModeProps) => {
  if (grouped.size === 0) {
    return (
      <p className="text-center text-sm text-stone-500 dark:text-gray-400 py-8">
        No items on your list. Generate a grocery list from your meal plan first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([category, items]) => {
        const unchecked = items.filter((i) => !i.isChecked);
        const checked = items.filter((i) => i.isChecked);
        const ordered = [...unchecked, ...checked];

        return (
          <div
            key={category}
            className="rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-white/[0.04]">
              <h4 className="text-base font-semibold text-stone-800 dark:text-gray-200">
                {CATEGORY_LABELS[category] || category}
              </h4>
              <Badge variant="secondary" className="text-xs">
                {checked.length}/{items.length}
              </Badge>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-white/[0.04]">
              {ordered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full flex items-center gap-4 px-4 py-4 text-left transition-colors ${
                    item.isChecked
                      ? 'bg-stone-50/80 dark:bg-white/[0.02] opacity-70'
                      : 'hover:bg-stone-50 dark:hover:bg-white/[0.04]'
                  }`}
                  onClick={() => onToggleCheck(item.id)}
                >
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                      item.isChecked
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'border-stone-300 dark:border-gray-600'
                    }`}
                  >
                    {item.isChecked && <Check className="h-4 w-4" />}
                  </span>

                  <span
                    className={`flex-1 flex items-baseline justify-between gap-3 text-base ${
                      item.isChecked
                        ? 'line-through text-stone-400 dark:text-gray-500'
                        : 'text-stone-800 dark:text-gray-200'
                    }`}
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    {(item.amount !== null || item.unit) && (
                      <span className="flex-shrink-0 font-semibold tabular-nums text-primary-600 dark:text-primary-400">
                        {item.amount !== null && item.amount}
                        {item.unit && (item.amount !== null ? ` ${item.unit}` : item.unit)}
                        {item.rawAmount !== undefined && (
                          <span className="ml-1 font-normal text-xs text-stone-400 dark:text-gray-500">
                            (need {item.rawAmount})
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ShoppingMode;
