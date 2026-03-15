import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRecipes, useUpdateMealPlan } from '@/services/api';
import {
  aggregateIngredients,
  groupByCategory,
  CATEGORY_LABELS,
} from '@/utils/ingredientAggregator';
import {
  ShoppingCart,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  Loader2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { GroceryItem, MealPlanMeals } from '@/types/mealPlan';

interface GroceryCartProps {
  plan: any; // The current week's meal plan
}

const GroceryCart = ({ plan }: GroceryCartProps) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [addingManual, setAddingManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  const { data: recipesData } = useRecipes({ limit: 200 });
  const updateMealPlan = useUpdateMealPlan();

  // Build recipe map from user's loaded recipes
  const recipeMap = useMemo(() => {
    const list = (recipesData as any)?.recipes || recipesData || [];
    const map = new Map<string, any>();
    for (const r of list) {
      map.set(r.id, {
        id: r.id,
        title: r.title,
        servings: r.servings || 4,
        ingredients: r.ingredients || [],
      });
    }
    return map;
  }, [recipesData]);

  // Current grocery list from the plan
  const groceryItems: GroceryItem[] = plan?.groceryList?.items || [];

  // Generate/regenerate grocery list from planned meals
  const handleGenerate = () => {
    if (!plan?.meals) {
      toast.error('No meals planned yet');
      return;
    }

    const items = aggregateIngredients(plan.meals as MealPlanMeals, recipeMap);

    // Preserve checked/removed state from existing items where names match
    const existingMap = new Map<string, GroceryItem>();
    for (const item of groceryItems) {
      existingMap.set(item.name.toLowerCase(), item);
    }

    // Preserve manual items
    const manualItems = groceryItems.filter((i) => i.isManual && !i.isRemoved);

    for (const item of items) {
      const existing = existingMap.get(item.name.toLowerCase());
      if (existing) {
        item.isChecked = existing.isChecked;
      }
    }

    const allItems = [...items, ...manualItems];

    updateMealPlan.mutate(
      {
        id: plan.id,
        data: {
          groceryList: {
            items: allItems,
            lastGenerated: new Date().toISOString(),
          },
        },
      },
      {
        onSuccess: () => toast.success(`Generated ${items.length} grocery items`),
        onError: (err: any) => toast.error(err?.message || 'Failed to generate list'),
      }
    );
  };

  // Toggle check on an item
  const handleToggleCheck = (itemId: string) => {
    const updated = groceryItems.map((i) =>
      i.id === itemId ? { ...i, isChecked: !i.isChecked } : i
    );
    saveGroceryList(updated);
  };

  // Remove an item
  const handleRemoveItem = (itemId: string) => {
    const updated = groceryItems.map((i) =>
      i.id === itemId ? { ...i, isRemoved: true } : i
    );
    saveGroceryList(updated);
  };

  // Add manual item
  const handleAddManual = () => {
    if (!manualName.trim()) return;
    const item: GroceryItem = {
      id: crypto.randomUUID(),
      name: manualName.trim(),
      amount: manualAmount ? parseFloat(manualAmount) || null : null,
      unit: manualUnit.trim(),
      category: 'other',
      sourceRecipes: [],
      isManual: true,
      isChecked: false,
      isRemoved: false,
    };
    const updated = [...groceryItems, item];
    saveGroceryList(updated);
    setManualName('');
    setManualAmount('');
    setManualUnit('');
    setAddingManual(false);
  };

  const saveGroceryList = (items: GroceryItem[]) => {
    updateMealPlan.mutate(
      {
        id: plan.id,
        data: {
          groceryList: {
            items,
            lastGenerated: plan.groceryList?.lastGenerated || new Date().toISOString(),
          },
        },
      },
      {
        onError: (err: any) => toast.error(err?.message || 'Failed to update grocery list'),
      }
    );
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const activeItems = groceryItems.filter((i) => !i.isRemoved);
  const checkedCount = activeItems.filter((i) => i.isChecked).length;
  const grouped = useMemo(() => groupByCategory(activeItems), [activeItems]);
  const hasMeals = plan?.meals && Object.keys(plan.meals).length > 0;

  // Empty state: no plan or no meals
  if (!plan) {
    return (
      <Card className="border-stone-200/60 dark:border-white/[0.06]">
        <CardContent className="p-8">
          <div className="text-center py-8">
            <div className="relative inline-flex mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/10 flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-amber-500/60" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-stone-800 dark:text-gray-200 mb-1.5">
              Grocery Cart
            </h3>
            <p className="text-sm text-stone-500 dark:text-gray-400 max-w-md mx-auto">
              Create a meal plan first, then add recipes to generate your grocery list.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              Grocery List
            </h3>
            <p className="text-xs text-stone-500 dark:text-gray-400">
              {activeItems.length > 0
                ? `${checkedCount}/${activeItems.length} items checked`
                : hasMeals
                  ? 'Click generate to build your list'
                  : 'Add recipes to your plan first'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs"
            onClick={() => setAddingManual(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl text-xs shadow-lg shadow-primary-500/20"
            onClick={handleGenerate}
            disabled={!hasMeals || updateMealPlan.isPending}
          >
            {updateMealPlan.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {activeItems.length > 0 ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Add manual item form */}
      {addingManual && (
        <Card className="border-primary-500/20 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400">Item Name</label>
                <Input
                  value={manualName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualName(e.target.value)}
                  placeholder="e.g. Paper towels"
                  className="mt-1 h-9"
                  autoFocus
                  onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAddManual()}
                />
              </div>
              <div className="w-20">
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400">Amount</label>
                <Input
                  value={manualAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualAmount(e.target.value)}
                  placeholder="2"
                  className="mt-1 h-9"
                />
              </div>
              <div className="w-20">
                <label className="text-xs font-medium text-stone-600 dark:text-gray-400">Unit</label>
                <Input
                  value={manualUnit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualUnit(e.target.value)}
                  placeholder="rolls"
                  className="mt-1 h-9"
                />
              </div>
              <Button size="sm" className="h-9 rounded-lg" onClick={handleAddManual}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-9 rounded-lg" onClick={() => setAddingManual(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grocery items by category */}
      {activeItems.length === 0 ? (
        <Card className="border-stone-200/60 dark:border-white/[0.06]">
          <CardContent className="p-8">
            <div className="text-center py-4">
              <Package className="h-10 w-10 text-stone-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-stone-500 dark:text-gray-400">
                {hasMeals
                  ? 'Click "Generate" to create your grocery list from planned meals.'
                  : 'Add recipes to your meal plan, then generate the grocery list.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {Array.from(grouped.entries()).map(([category, items]) => {
            const isCollapsed = collapsedCategories.has(category);
            const catChecked = items.filter((i) => i.isChecked).length;
            const allChecked = catChecked === items.length;

            return (
              <Card key={category} className="border-stone-200/60 dark:border-white/[0.06] overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-stone-400" />
                    )}
                    <span className={`text-sm font-semibold ${allChecked ? 'text-stone-400 line-through' : 'text-stone-800 dark:text-gray-200'}`}>
                      {CATEGORY_LABELS[category] || category}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {catChecked}/{items.length}
                    </Badge>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="px-4 pb-3 space-y-1 animate-fade-in">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                          item.isChecked
                            ? 'bg-stone-50 dark:bg-white/[0.02] opacity-60'
                            : ''
                        }`}
                      >
                        <button
                          className={`flex-shrink-0 w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                            item.isChecked
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : 'border-stone-300 dark:border-gray-600 hover:border-primary-400'
                          }`}
                          onClick={() => handleToggleCheck(item.id)}
                        >
                          {item.isChecked && <Check className="h-3 w-3" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${
                            item.isChecked
                              ? 'line-through text-stone-400 dark:text-gray-500'
                              : 'text-stone-700 dark:text-gray-300'
                          }`}>
                            {item.amount !== null && (
                              <span className="font-medium">{item.amount} </span>
                            )}
                            {item.unit && (
                              <span className="text-stone-500 dark:text-gray-400">{item.unit} </span>
                            )}
                            {item.name}
                          </p>
                          {item.sourceRecipes.length > 0 && (
                            <p className="text-[10px] text-stone-400 dark:text-gray-500 mt-0.5 truncate">
                              From: {item.sourceRecipes.join(', ')}
                            </p>
                          )}
                          {item.isManual && (
                            <Badge variant="outline" className="text-[9px] h-4 mt-0.5">
                              manual
                            </Badge>
                          )}
                        </div>

                        <button
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-destructive transition-all"
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Summary */}
          <div className="flex items-center justify-between px-2 pt-2">
            <p className="text-xs text-stone-400 dark:text-gray-500">
              {plan.groceryList?.lastGenerated && (
                <>Last generated: {new Date(plan.groceryList.lastGenerated).toLocaleString()}</>
              )}
            </p>
            <p className="text-xs font-medium text-stone-600 dark:text-gray-400">
              {checkedCount === activeItems.length
                ? 'All items checked!'
                : `${activeItems.length - checkedCount} items remaining`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroceryCart;
