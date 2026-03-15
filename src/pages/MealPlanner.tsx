import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/authStore';
import {
  useMealPlans,
  useCreateMealPlan,
  useUpdateMealPlan,
  useDeleteMealPlan,
  useCopyMealPlan,
} from '@/services/api';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Clock,
  ChefHat,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Archive,
  CheckCircle2,
  Sun,
  Coffee,
  Moon,
  Cookie,
  X,
  Pencil,
  Play,
  LayoutGrid,
  Rows,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { MealPlanStatus, MealSlot, PlannedMealEntry } from '@/types/mealPlan';
import type { SelectedRecipeInfo } from '@/components/meal-planning/recipeTypes';
import RecipeSelectorModal from '@/components/grocery/RecipeSelectorModal';
import ServingsModal from '@/components/meal-planning/ServingsModal';
import GroceryCart from '@/components/meal-planning/GroceryCart';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Daily meal slots (shown per-day in the calendar grid)
const DAILY_SLOTS: { key: MealSlot; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-500' },
  { key: 'lunch', label: 'Lunch', icon: Sun, color: 'text-orange-500' },
  { key: 'dinner', label: 'Dinner', icon: Moon, color: 'text-indigo-500' },
];

// Plan-level lists (shown below the calendar as weekly lists)
const PLAN_LISTS: { key: string; label: string; icon: React.ElementType; color: string; description: string }[] = [
  { key: '_snacks', label: 'Snacks', icon: Cookie, color: 'text-pink-500', description: 'Weekly snacks — not tied to a specific day' },
  { key: '_non_recipe', label: 'Non-Recipe Items', icon: ShoppingCart, color: 'text-teal-500', description: 'Extras like paper towels, foil, etc.' },
];

const STATUS_CONFIG: Record<MealPlanStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-100 dark:bg-white/[0.04]' },
  active: { label: 'Active', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  completed: { label: 'Done', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  archived: { label: 'Archived', color: 'text-stone-500 dark:text-stone-500', bg: 'bg-stone-100 dark:bg-stone-800' },
};

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
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

function getMealCount(meals: any, dateStr: string): number {
  const dayMeals = meals?.[dateStr];
  if (!dayMeals) return 0;
  return (dayMeals.breakfast?.length || 0) +
    (dayMeals.lunch?.length || 0) +
    (dayMeals.dinner?.length || 0);
}

function getPlanListCount(meals: any, key: string): number {
  return meals?.[key]?.length || 0;
}

function getWeekMealCount(meals: any, weekDates: Date[]): number {
  const dailyCount = weekDates.reduce((sum, d) => sum + getMealCount(meals, formatDateKey(d)), 0);
  const snacksCount = getPlanListCount(meals, '_snacks');
  const nonRecipeCount = getPlanListCount(meals, '_non_recipe');
  return dailyCount + snacksCount + nonRecipeCount;
}

const MealPlanner = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('calendar');
  const [calendarView, setCalendarView] = useState<'days' | 'meals'>('days');
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [planMenuOpen, setPlanMenuOpen] = useState<string | null>(null);
  const [isEditingPlanTitle, setIsEditingPlanTitle] = useState(false);
  const [editedPlanTitle, setEditedPlanTitle] = useState('');
  const [bannerMenuOpen, setBannerMenuOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSlot, setSelectorSlot] = useState<MealSlot>('dinner');
  const [selectorDate, setSelectorDate] = useState('');
  const [pendingMultiRecipes, setPendingMultiRecipes] = useState<SelectedRecipeInfo[]>([]);
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [planListInputs, setPlanListInputs] = useState<Record<string, string>>({});
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditRef = useRef<HTMLDivElement>(null);
  const bannerMenuRef = useRef<HTMLDivElement>(null);

  // Click-outside to save title
  useEffect(() => {
    if (!isEditingPlanTitle) return;
    const handler = (e: MouseEvent) => {
      if (titleEditRef.current && !titleEditRef.current.contains(e.target as Node)) {
        handleSavePlanTitle();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

  // Click-outside to close banner menu
  useEffect(() => {
    if (!bannerMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (bannerMenuRef.current && !bannerMenuRef.current.contains(e.target as Node)) {
        setBannerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  });

  // Queries & mutations
  const { data: mealPlans, isLoading } = useMealPlans();
  const createMealPlan = useCreateMealPlan();
  const updateMealPlan = useUpdateMealPlan();
  const deleteMealPlan = useDeleteMealPlan();
  const copyMealPlan = useCopyMealPlan();

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const today = formatDateKey(new Date());

  // Find plan for the current week (any non-archived status, prefer active > draft > completed)
  const weekStart = formatDateKey(currentWeek);
  const weekEnd = formatDateKey(weekDates[6]);

  const weekPlan = useMemo(() => {
    if (!mealPlans) return null;
    const weekPlans = mealPlans.filter((p: any) =>
      p.status !== 'archived' &&
      p.startDate <= weekEnd && p.endDate >= weekStart
    );
    // Prefer active, then draft, then completed
    const priority: Record<string, number> = { active: 0, draft: 1, completed: 2 };
    weekPlans.sort((a: any, b: any) => (priority[a.status] ?? 3) - (priority[b.status] ?? 3));
    return weekPlans[0] || null;
  }, [mealPlans, weekStart, weekEnd]);

  const historyPlans = useMemo(() => {
    if (!mealPlans) return [];
    return mealPlans.filter((p: any) => p.status === 'completed' || p.status === 'archived');
  }, [mealPlans]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const handleCreatePlan = () => {
    const startDate = formatDateKey(currentWeek);
    const endDateObj = new Date(currentWeek);
    endDateObj.setDate(endDateObj.getDate() + 6);

    createMealPlan.mutate(
      {
        title: newPlanTitle.trim() || `Week of ${currentWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        startDate,
        endDate: formatDateKey(endDateObj),
        meals: {},
        status: 'draft',
      },
      {
        onSuccess: () => {
          toast.success('Meal plan created');
          setShowCreateForm(false);
          setNewPlanTitle('');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to create plan'),
      }
    );
  };

  const handleStatusChange = (planId: string, status: MealPlanStatus) => {
    updateMealPlan.mutate(
      { id: planId, data: { status } },
      {
        onSuccess: () => {
          toast.success(`Plan marked as ${STATUS_CONFIG[status].label.toLowerCase()}`);
          setPlanMenuOpen(null);
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to update plan'),
      }
    );
  };

  const handleDeletePlan = (planId: string) => {
    deleteMealPlan.mutate(planId, {
      onSuccess: () => {
        toast.success('Plan deleted');
        setPlanMenuOpen(null);
      },
      onError: (err: any) => toast.error(err?.message || 'Failed to delete plan'),
    });
  };

  const handleCopyPlan = (sourceId: string) => {
    const startDate = formatDateKey(currentWeek);
    const endDateObj = new Date(currentWeek);
    endDateObj.setDate(endDateObj.getDate() + 6);

    copyMealPlan.mutate(
      { sourceId, newDateRange: { startDate, endDate: formatDateKey(endDateObj) } },
      {
        onSuccess: () => {
          toast.success('Plan copied to current week');
          setPlanMenuOpen(null);
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to copy plan'),
      }
    );
  };

  const handleSavePlanTitle = () => {
    if (!weekPlan) return;
    updateMealPlan.mutate(
      { id: weekPlan.id, data: { title: editedPlanTitle.trim() || null } },
      {
        onSuccess: () => {
          toast.success('Plan title updated');
          setIsEditingPlanTitle(false);
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to update title'),
      }
    );
  };

  const openRecipeSelector = (date: string, slot: MealSlot) => {
    setSelectorDate(date);
    setSelectorSlot(slot);
    setSelectorOpen(true);
  };

  const handleMultiSelectDone = (recipes: SelectedRecipeInfo[]) => {
    setSelectorOpen(false);
    if (recipes.length === 0) return;
    setPendingMultiRecipes(recipes);
    setShowServingsModal(true);
  };

  const handleServingsConfirmed = (recipes: SelectedRecipeInfo[]) => {
    setShowServingsModal(false);
    if (!weekPlan || recipes.length === 0) return;

    const targetDate = selectorDate;
    const targetSlot = selectorSlot;
    const currentMeals = { ...(weekPlan.meals || {}) };

    for (const recipe of recipes) {
      const entry: PlannedMealEntry = {
        id: crypto.randomUUID(),
        recipeId: recipe.recipeId,
        recipeName: recipe.recipeName,
        recipeImage: recipe.recipeImage,
        servings: recipe.servings,
      };

      if (targetDate.startsWith('_')) {
        const listItems = [...(currentMeals[targetDate] || [])];
        listItems.push(entry);
        currentMeals[targetDate] = listItems;
      } else {
        const dayMeals = { ...(currentMeals[targetDate] || {}) };
        const slotMeals = [...(dayMeals[targetSlot] || [])];
        slotMeals.push(entry);
        dayMeals[targetSlot] = slotMeals;
        currentMeals[targetDate] = dayMeals;
      }
    }

    updateMealPlan.mutate(
      { id: weekPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => toast.success(`Added ${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`),
        onError: (err: any) => toast.error(err?.message || 'Failed to add recipes'),
      }
    );
  };

  const handleAddPlanListItem = (listKey: string, name: string) => {
    if (!weekPlan || !name.trim()) return;
    const currentMeals = { ...(weekPlan.meals || {}) };
    const listItems = [...(currentMeals[listKey] || [])];

    listItems.push({
      id: crypto.randomUUID(),
      recipeName: name.trim(),
      recipeId: '',
      servings: 1,
    });
    currentMeals[listKey] = listItems;

    updateMealPlan.mutate(
      { id: weekPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => toast.success(`Added "${name.trim()}"`),
        onError: (err: any) => toast.error(err?.message || 'Failed to add item'),
      }
    );
  };

  const handleRemovePlanListItem = (listKey: string, itemId: string) => {
    if (!weekPlan) return;
    const currentMeals = { ...(weekPlan.meals || {}) };
    const listItems = (currentMeals[listKey] || []).filter((m: any) => m.id !== itemId);
    currentMeals[listKey] = listItems;

    updateMealPlan.mutate(
      { id: weekPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => toast.success('Item removed'),
        onError: (err: any) => toast.error(err?.message || 'Failed to remove item'),
      }
    );
  };

  const handleRemoveMeal = (dateStr: string, slot: MealSlot, mealId: string) => {
    if (!weekPlan) return;
    const currentMeals = { ...(weekPlan.meals || {}) };
    const dayMeals = { ...(currentMeals[dateStr] || {}) };
    const slotMeals = (dayMeals[slot] || []).filter((m: any) => m.id !== mealId);
    dayMeals[slot] = slotMeals;
    currentMeals[dateStr] = dayMeals;

    updateMealPlan.mutate(
      { id: weekPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => toast.success('Meal removed'),
        onError: (err: any) => toast.error(err?.message || 'Failed to remove meal'),
      }
    );
  };

  const weekLabel = `${currentWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="bg-stone-50 dark:bg-[#0e0f13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">

        {/* ── Header: Title + Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Meal Planner
          </h1>
            <TabsList className="gap-1 p-1 rounded-xl bg-stone-100/80 dark:bg-white/[0.04] border border-stone-200/60 dark:border-white/[0.06]">
              <TabsTrigger value="calendar" className="gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 data-[state=active]:shadow-md">
                <Calendar className="h-3.5 w-3.5" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="grocery" className="gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 data-[state=active]:shadow-md">
                <ShoppingCart className="h-3.5 w-3.5" />
                Grocery
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 data-[state=active]:shadow-md">
                <Clock className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>
        </div>

        {/* ── Create Plan Form ── */}
        {showCreateForm && (
          <Card className="border-[#1D9E75]/20 shadow-lg shadow-[#1D9E75]/5 animate-slide-up">
            <CardContent className="p-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="plan-title" className="text-xs font-medium">New Plan for {weekLabel}</Label>
                  <Input
                    id="plan-title"
                    placeholder={`Week of ${currentWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    value={newPlanTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPlanTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleCreatePlan} disabled={createMealPlan.isPending} className="gap-2">
                  {createMealPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateForm(false); setNewPlanTitle(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

          {/* ── Calendar Tab ── */}
          <TabsContent value="calendar" className="mt-4 space-y-3">
            {/* Week Navigation + Plan Info — single compact row */}
            <div className="flex items-center justify-between gap-2">
              {/* Left: prev + week label + next */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-sm font-semibold text-stone-900 dark:text-white whitespace-nowrap">
                  {weekLabel}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Center: plan title + status (if plan exists) */}
              {weekPlan && (
                <div className="flex items-center gap-2 min-w-0">
                  {isEditingPlanTitle ? (
                    <div ref={titleEditRef}>
                      <Input
                        ref={titleInputRef}
                        value={editedPlanTitle}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedPlanTitle(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'Enter') handleSavePlanTitle();
                          if (e.key === 'Escape') setIsEditingPlanTitle(false);
                        }}
                        className="h-7 text-xs w-36"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      className="text-xs font-medium text-stone-600 dark:text-gray-300 hover:text-[#1D9E75] transition-colors truncate max-w-[160px]"
                      onClick={() => {
                        setEditedPlanTitle(weekPlan.title || '');
                        setIsEditingPlanTitle(true);
                      }}
                      title="Click to rename"
                    >
                      {weekPlan.title || 'Untitled Plan'}
                    </button>
                  )}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.bg} ${STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.color}`}>
                    {STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.label}
                  </span>
                  <span className="text-[10px] text-stone-400 dark:text-gray-500 flex-shrink-0">
                    {getWeekMealCount(weekPlan.meals, weekDates)} meals
                  </span>
                  {/* Ellipsis menu */}
                  <div className="relative flex-shrink-0" ref={bannerMenuRef}>
                    <button
                      className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                      onClick={() => setBannerMenuOpen(!bannerMenuOpen)}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {bannerMenuOpen && (
                      <div className="absolute right-0 top-7 z-50 min-w-[140px] rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-[#16171c] p-1 shadow-xl animate-scale-in">
                        {weekPlan.status === 'draft' && (
                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors text-emerald-600 dark:text-emerald-400"
                            onClick={() => { handleStatusChange(weekPlan.id, 'active'); setBannerMenuOpen(false); }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start Plan
                          </button>
                        )}
                        {weekPlan.status === 'active' && (
                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors text-emerald-600 dark:text-emerald-400"
                            onClick={() => { handleStatusChange(weekPlan.id, 'completed'); setBannerMenuOpen(false); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete
                          </button>
                        )}
                        {weekPlan.status === 'completed' && (
                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors"
                            onClick={() => { handleStatusChange(weekPlan.id, 'active'); setBannerMenuOpen(false); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modify
                          </button>
                        )}
                        <div className="my-0.5 border-t border-stone-100 dark:border-white/[0.06]" />
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/5 transition-colors"
                          onClick={() => { handleStatusChange(weekPlan.id, 'archived'); setBannerMenuOpen(false); }}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!weekPlan && !isLoading && (
                <Button
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  className="gap-1.5 rounded-xl text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Plan
                </Button>
              )}

              {/* Right: view toggle */}
              <div className="flex items-center rounded-lg border border-stone-200/80 dark:border-white/[0.08] bg-stone-100/60 dark:bg-white/[0.03] p-0.5 flex-shrink-0">
                <button
                  className={`p-1.5 rounded-md transition-all duration-200 ${calendarView === 'days' ? 'bg-white dark:bg-white/[0.1] shadow-sm text-[#1D9E75]' : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300'}`}
                  onClick={() => setCalendarView('days')}
                  title="Days view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  className={`p-1.5 rounded-md transition-all duration-200 ${calendarView === 'meals' ? 'bg-white dark:bg-white/[0.1] shadow-sm text-[#1D9E75]' : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300'}`}
                  onClick={() => setCalendarView('meals')}
                  title="Meals view"
                >
                  <Rows className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Calendar Grid — Days View or Meals View */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#1D9E75]/50" />
              </div>
            ) : calendarView === 'days' ? (
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {weekDates.map((date, i) => {
                  const dateStr = formatDateKey(date);
                  const isToday = dateStr === today;
                  return (
                    <div key={`header-${i}`} className="text-center pb-1">
                      <p className="text-xs font-medium text-stone-400 dark:text-gray-500 uppercase tracking-widest">
                        {DAYS_SHORT[i]}
                      </p>
                      <p className={`text-lg font-bold mt-0.5 transition-colors ${
                        isToday
                          ? 'text-[#1D9E75]'
                          : 'text-stone-700 dark:text-gray-300'
                      }`}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}

                {/* Day Columns */}
                {weekDates.map((date) => {
                  const dateStr = formatDateKey(date);
                  const isToday = dateStr === today;
                  const dayMeals = weekPlan?.meals?.[dateStr];

                  return (
                    <div
                      key={dateStr}
                      className={`group relative rounded-2xl border p-2.5 min-h-[220px] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                        isToday
                          ? 'border-[#1D9E75]/30 bg-[#1D9E75]/[0.03] dark:bg-[#1D9E75]/[0.05] shadow-md shadow-[#1D9E75]/10 ring-1 ring-[#1D9E75]/20'
                          : 'border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-stone-300 dark:hover:border-white/[0.12]'
                      }`}
                    >
                      {/* Today indicator dot */}
                      {isToday && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse-slow" />
                      )}

                      <div className="space-y-1.5">
                        {DAILY_SLOTS.map((slot) => {
                          const slotMeals = dayMeals?.[slot.key] || [];
                          return (
                            <div key={slot.key} className="group/slot">
                              <div className="flex items-center gap-1 mb-0.5">
                                <slot.icon className={`h-3 w-3 ${slot.color} opacity-60`} />
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-gray-500">
                                  {slot.label}
                                </span>
                              </div>
                              {slotMeals.length > 0 ? (
                                <>
                                  {slotMeals.map((meal: any) => (
                                    <div
                                      key={meal.id}
                                      className="group/meal flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-xs text-stone-700 dark:text-gray-300 transition-all duration-200 hover:bg-stone-100 dark:hover:bg-white/[0.08] hover:shadow-sm"
                                      title={meal.recipeName}
                                    >
                                      <span className="truncate flex-1">{meal.recipeName}</span>
                                      <button
                                        className="flex-shrink-0 opacity-0 group-hover/meal:opacity-100 text-stone-400 hover:text-destructive transition-all"
                                        onClick={() => handleRemoveMeal(dateStr, slot.key, meal.id)}
                                        title="Remove"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="w-full px-2 py-0.5 rounded-lg text-[10px] text-stone-300 dark:text-gray-600 hover:text-primary/60 transition-all duration-200 opacity-0 group-hover/slot:opacity-100"
                                    onClick={() => openRecipeSelector(dateStr, slot.key)}
                                  >
                                    + Add more
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="w-full px-2 py-1 rounded-lg border border-dashed border-stone-200/60 dark:border-white/[0.06] text-[10px] text-stone-300 dark:text-gray-600 hover:border-primary/40 hover:text-primary/60 hover:bg-primary/[0.02] transition-all duration-200 opacity-0 group-hover/slot:opacity-100 group-hover:opacity-60"
                                  onClick={() => openRecipeSelector(dateStr, slot.key)}
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Meals View: rows by meal type, columns by day ── */
              <div className="space-y-3 animate-fade-in">
                {[...DAILY_SLOTS, { key: 'snacks' as MealSlot, label: 'Snacks', icon: Cookie, color: 'text-pink-500' }].map((slot) => {
                  const isSnacks = slot.key === 'snacks';
                  const snackItems: PlannedMealEntry[] = isSnacks ? (weekPlan?.meals?.['_snacks'] || []) as PlannedMealEntry[] : [];
                  const totalForSlot = isSnacks
                    ? snackItems.length
                    : weekDates.reduce((sum, date) => {
                        const dateStr = formatDateKey(date);
                        return sum + (weekPlan?.meals?.[dateStr]?.[slot.key]?.length || 0);
                      }, 0);

                  return (
                    <div
                      key={slot.key}
                      className="rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden transition-all duration-300 hover:shadow-md"
                    >
                      {/* Slot header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-white/[0.04]">
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${
                          slot.key === 'breakfast' ? 'from-amber-500/10 to-amber-500/5' :
                          slot.key === 'lunch' ? 'from-orange-500/10 to-orange-500/5' :
                          slot.key === 'dinner' ? 'from-indigo-500/10 to-indigo-500/5' :
                          'from-pink-500/10 to-pink-500/5'
                        }`}>
                          <slot.icon className={`h-4 w-4 ${slot.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-stone-800 dark:text-gray-200">
                            {slot.label}
                          </h3>
                          <p className="text-[10px] text-stone-400 dark:text-gray-500">
                            {totalForSlot} {totalForSlot === 1 ? 'recipe' : 'recipes'} planned
                          </p>
                        </div>
                        {!isSnacks && weekPlan && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 rounded-lg text-xs text-stone-400 hover:text-primary"
                            onClick={() => openRecipeSelector(formatDateKey(weekDates[0]), slot.key)}
                            title={`Add ${slot.label}`}
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </Button>
                        )}
                      </div>

                      {/* Content */}
                      {isSnacks ? (
                        /* Snacks: plan-level list (not per-day) */
                        <div className="p-3">
                          {snackItems.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {snackItems.map((item: PlannedMealEntry) => (
                                <div
                                  key={item.id}
                                  className="group/item flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-xs text-stone-700 dark:text-gray-300 transition-all hover:bg-stone-100 dark:hover:bg-white/[0.08]"
                                >
                                  <Cookie className="h-3 w-3 text-pink-400 flex-shrink-0" />
                                  <span className="truncate">{item.recipeName}</span>
                                  <button
                                    className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 text-stone-400 hover:text-destructive transition-all"
                                    onClick={() => handleRemovePlanListItem('_snacks', item.id)}
                                    title="Remove"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 dark:text-gray-500 text-center py-3">
                              No snacks added yet
                            </p>
                          )}
                          {weekPlan && (
                            <div className="mt-2 flex justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 rounded-lg text-xs text-stone-400 hover:text-primary"
                                onClick={() => openRecipeSelector('_snacks', 'snacks')}
                              >
                                <Plus className="h-3 w-3" />
                                Add Snack
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Daily slots: 7-day horizontal grid */
                        <div className="grid grid-cols-7 divide-x divide-stone-100 dark:divide-white/[0.04]">
                          {weekDates.map((date) => {
                            const dateStr = formatDateKey(date);
                            const isToday = dateStr === today;
                            const slotMeals = weekPlan?.meals?.[dateStr]?.[slot.key] || [];

                            return (
                              <div
                                key={dateStr}
                                className={`group p-2 min-h-[80px] transition-colors ${
                                  isToday ? 'bg-primary/[0.03] dark:bg-primary/[0.05]' : ''
                                }`}
                              >
                                {/* Day label */}
                                <p className={`text-[10px] font-semibold text-center mb-1.5 ${
                                  isToday ? 'text-primary' : 'text-stone-400 dark:text-gray-500'
                                }`}>
                                  {DAYS_SHORT[date.getDay()]} {date.getDate()}
                                </p>

                                {/* Meals */}
                                <div className="space-y-1">
                                  {slotMeals.map((meal: any) => (
                                    <div
                                      key={meal.id}
                                      className="group/meal flex items-center gap-0.5 px-1.5 py-1 rounded-md bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-[10px] text-stone-700 dark:text-gray-300 transition-all hover:bg-stone-100 dark:hover:bg-white/[0.08]"
                                      title={meal.recipeName}
                                    >
                                      <span className="truncate flex-1">{meal.recipeName}</span>
                                      <button
                                        className="flex-shrink-0 opacity-0 group-hover/meal:opacity-100 text-stone-400 hover:text-destructive transition-all"
                                        onClick={() => handleRemoveMeal(dateStr, slot.key, meal.id)}
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ))}

                                  {/* Add button */}
                                  {weekPlan && (
                                    <button
                                      className="w-full px-1 py-0.5 rounded-md text-[10px] text-stone-300 dark:text-gray-600 hover:text-primary/60 hover:bg-primary/[0.02] transition-all duration-200 opacity-0 group-hover:opacity-100"
                                      onClick={() => openRecipeSelector(dateStr, slot.key)}
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Plan-level Lists (Snacks, Non-Recipe Items) — days view only */}
            {!isLoading && weekPlan && calendarView === 'days' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {PLAN_LISTS.map((list) => {
                  const items = weekPlan.meals?.[list.key] || [];
                  const inputVal = planListInputs[list.key] || '';
                  return (
                    <div
                      key={list.key}
                      className="rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4 transition-all duration-300 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <list.icon className={`h-4 w-4 ${list.color}`} />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-stone-800 dark:text-gray-200">
                            {list.label}
                          </h4>
                          <p className="text-[10px] text-stone-400 dark:text-gray-500">{list.description}</p>
                        </div>
                        {items.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {items.length}
                          </Badge>
                        )}
                      </div>

                      {/* Items */}
                      <div className="space-y-1 mb-2">
                        {items.map((item: any) => (
                          <div
                            key={item.id}
                            className="group/item flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-xs text-stone-700 dark:text-gray-300 transition-all duration-200 hover:bg-stone-100 dark:hover:bg-white/[0.08]"
                          >
                            <span className="truncate flex-1">{item.recipeName}</span>
                            <button
                              className="flex-shrink-0 opacity-0 group-hover/item:opacity-100 text-stone-400 hover:text-destructive transition-all"
                              onClick={() => handleRemovePlanListItem(list.key, item.id)}
                              title="Remove"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add input */}
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={inputVal}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPlanListInputs((prev) => ({ ...prev, [list.key]: e.target.value }))
                          }
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' && inputVal.trim()) {
                              handleAddPlanListItem(list.key, inputVal);
                              setPlanListInputs((prev) => ({ ...prev, [list.key]: '' }));
                            }
                          }}
                          placeholder={`Add ${list.label.toLowerCase()}...`}
                          className="h-8 text-xs rounded-lg flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg"
                          onClick={() => {
                            if (inputVal.trim()) {
                              handleAddPlanListItem(list.key, inputVal);
                              setPlanListInputs((prev) => ({ ...prev, [list.key]: '' }));
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {list.key === '_snacks' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-stone-400 hover:text-primary"
                            onClick={() => openRecipeSelector('_snacks', 'snacks')}
                            title="Pick from recipes"
                          >
                            <ChefHat className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No Plan CTA */}
            {!isLoading && !weekPlan && (
              <div className="text-center py-12">
                <div className="relative inline-flex mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center">
                    <ChefHat className="w-8 h-8 text-primary/60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#1D9E75] flex items-center justify-center shadow-lg shadow-[#1D9E75]/30">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-stone-800 dark:text-gray-200 mb-1.5">
                  No plan for this week
                </h3>
                <p className="text-sm text-stone-500 dark:text-gray-400 max-w-sm mx-auto mb-5">
                  Create a meal plan to start organizing your week and building a grocery list.
                </p>
                <Button onClick={() => setShowCreateForm(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Plan for This Week
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Grocery Cart Tab ── */}
          <TabsContent value="grocery" className="mt-6">
            <GroceryCart plan={weekPlan} />
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="mt-6 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#1D9E75]/50" />
              </div>
            ) : historyPlans.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-10 w-10 text-stone-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-stone-800 dark:text-gray-200 mb-1">
                  No history yet
                </h3>
                <p className="text-sm text-stone-500 dark:text-gray-400">
                  Completed and archived plans will appear here.
                </p>
              </div>
            ) : (
              historyPlans.map((plan: any) => {
                const statusCfg = STATUS_CONFIG[plan.status as MealPlanStatus] || STATUS_CONFIG.completed;
                const mealCount = plan.meals ? Object.values(plan.meals).reduce((sum: number, day: any) => {
                  if (!day || typeof day !== 'object') return sum;
                  return sum + (day.breakfast?.length || 0) + (day.lunch?.length || 0) + (day.dinner?.length || 0) + (day.snacks?.length || 0);
                }, 0) : 0;

                return (
                  <div
                    key={plan.id}
                    className="group flex items-center justify-between p-4 rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:shadow-md hover:-translate-y-px transition-all duration-300"
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
                          {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' – '}
                          {new Date(plan.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          <span className="mx-1.5 text-stone-300 dark:text-gray-600">|</span>
                          {mealCount} meals
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl text-xs hover:shadow-md transition-all duration-200"
                        onClick={() => handleCopyPlan(plan.id)}
                        disabled={copyMealPlan.isPending}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-xl"
                          onClick={() => setPlanMenuOpen(planMenuOpen === plan.id ? null : plan.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {planMenuOpen === plan.id && (
                          <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-gray-900 p-1.5 shadow-xl animate-scale-in">
                            {plan.status === 'archived' && (
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors"
                                onClick={() => handleStatusChange(plan.id, 'completed')}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Restore
                              </button>
                            )}
                            {plan.status !== 'archived' && (
                              <button
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors"
                                onClick={() => handleStatusChange(plan.id, 'archived')}
                              >
                                <Archive className="h-4 w-4" />
                                Archive
                              </button>
                            )}
                            <div className="my-1 border-t border-stone-100 dark:border-white/[0.06]" />
                            <button
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                              onClick={() => handleDeletePlan(plan.id)}
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
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Recipe Selector Modal (all recipe selection) */}
      <RecipeSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onConfirm={handleMultiSelectDone}
        ctaVerb="Select"
      />

      {/* Servings Modal (after multi-select) */}
      <ServingsModal
        open={showServingsModal}
        recipes={pendingMultiRecipes}
        onConfirm={handleServingsConfirmed}
        onClose={() => setShowServingsModal(false)}
      />
    </div>
  );
};

export default MealPlanner;
