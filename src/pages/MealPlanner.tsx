import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import DayAssignmentModal from '@/components/meal-planning/DayAssignmentModal';
import type { RecipeAssignment } from '@/components/meal-planning/DayAssignmentModal';
import GroceryCart from '@/components/meal-planning/GroceryCart';
import MealPlanHistory from '@/components/meal-planning/MealPlanHistory';
import { PlannerSettingsMenu } from '@/components/meal-planning/PlannerSettingsMenu';

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
  active: { label: 'Active', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-500/10' },
  completed: { label: 'Done', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-500/10' },
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

/** All calendar dates in [startDate, endDate] inclusive. */
function getPlanDates(startDate: string, endDate: string): Date[] {
  const dates: Date[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Partition an array into chunks of size n. */
function chunkArray<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

/** Duration options for the create-plan form. */
const DURATION_OPTIONS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '4 weeks', days: 28 },
] as const;

const MealPlanner = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [calendarView, setCalendarView] = useState<'days' | 'meals'>('days');
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanDays, setNewPlanDays] = useState<7 | 14 | 28>(7);
  const [planMenuOpen, setPlanMenuOpen] = useState<string | null>(null);
  const [isEditingPlanTitle, setIsEditingPlanTitle] = useState(false);
  const [editedPlanTitle, setEditedPlanTitle] = useState('');
  const [bannerMenuOpen, setBannerMenuOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorSlot, setSelectorSlot] = useState<MealSlot>('dinner');
  const [selectorDate, setSelectorDate] = useState('');
  const [pendingMultiRecipes, setPendingMultiRecipes] = useState<SelectedRecipeInfo[]>([]);
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
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

  // ── Multi-week plan support (MOP-0021) ────────────────────────────────────
  // planDates = every day in weekPlan's date range (may be 7, 14, or 28 days)
  // planWeeks = planDates partitioned into 7-day rows for the meals view
  // currentPlanWeekIndex = which week row the navigator is currently showing
  const planDates = useMemo(() => {
    if (!weekPlan) return weekDates; // fall back to navigator week
    return getPlanDates(weekPlan.startDate, weekPlan.endDate);
  }, [weekPlan, weekDates]);

  const planWeeks = useMemo(() => chunkArray(planDates, 7), [planDates]);

  const currentPlanWeekIndex = useMemo(() => {
    if (planWeeks.length <= 1) return 0;
    return planWeeks.findIndex(week =>
      week.some(d => formatDateKey(d) >= weekStart && formatDateKey(d) <= weekEnd)
    );
  }, [planWeeks, weekStart, weekEnd]);

  // Track which slot sections have had extra weeks expanded in the meals view
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const toggleExpandedWeek = (slotKey: string) =>
    setExpandedWeeks(prev => ({ ...prev, [slotKey]: !prev[slotKey] }));

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const handleCreatePlan = () => {
    const startDate = formatDateKey(currentWeek);
    const endDateObj = new Date(currentWeek);
    endDateObj.setDate(endDateObj.getDate() + newPlanDays - 1);
    const durationLabel = DURATION_OPTIONS.find(o => o.days === newPlanDays)?.label ?? `${newPlanDays} days`;

    createMealPlan.mutate(
      {
        title: newPlanTitle.trim() || `${durationLabel} — ${currentWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
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
          setNewPlanDays(7);
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
    if (recipes.length === 0) return;
    setPendingMultiRecipes(recipes);
    setShowAssignmentModal(true);
  };

  const handleAssignmentConfirmed = (assignments: RecipeAssignment[]) => {
    setShowAssignmentModal(false);
    if (!weekPlan || assignments.length === 0) return;

    const currentMeals = { ...(weekPlan.meals || {}) };

    for (const { recipe, slot, dates } of assignments) {
      const entry: PlannedMealEntry = {
        id: crypto.randomUUID(),
        recipeId: recipe.recipeId,
        recipeName: recipe.recipeName,
        recipeImage: recipe.recipeImage,
        servings: recipe.servings,
      };

      if (slot === 'snacks') {
        // Plan-level snacks list
        const listItems = [...(currentMeals['_snacks'] || [])];
        listItems.push(entry);
        currentMeals['_snacks'] = listItems;
      } else {
        // Add to each assigned date
        for (const dateStr of dates) {
          const dayMeals = { ...(currentMeals[dateStr] || {}) };
          const slotMeals = [...(dayMeals[slot] || [])];
          slotMeals.push({ ...entry, id: crypto.randomUUID() });
          dayMeals[slot] = slotMeals;
          currentMeals[dateStr] = dayMeals;
        }
      }
    }

    const totalAdded = assignments.reduce((sum, a) => sum + Math.max(1, a.dates.length), 0);
    updateMealPlan.mutate(
      { id: weekPlan.id, data: { meals: currentMeals } },
      {
        onSuccess: () => toast.success(`Added ${totalAdded} ${totalAdded === 1 ? 'recipe' : 'recipes'}`),
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
          <Card className="border-primary-500/20 shadow-lg shadow-primary-500/5 animate-slide-up">
            <CardContent className="p-4 space-y-3">
              {/* Title row */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="plan-title" className="text-xs font-medium">
                    New Plan — starting {currentWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Label>
                  <Input
                    id="plan-title"
                    placeholder="Plan title (optional)"
                    value={newPlanTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPlanTitle(e.target.value)}
                    className="mt-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateForm(false); setNewPlanTitle(''); setNewPlanDays(7); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Duration picker + create */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 dark:text-stone-400 shrink-0">Duration:</span>
                <div className="flex gap-1">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      onClick={() => setNewPlanDays(opt.days as 7 | 14 | 28)}
                      className={[
                        'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                        newPlanDays === opt.days
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-stone-200 dark:border-white/[0.08] text-stone-500 dark:text-stone-400 hover:border-stone-300',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <Button onClick={handleCreatePlan} disabled={createMealPlan.isPending} size="sm" className="gap-1.5">
                  {createMealPlan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create
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
                <div className="flex flex-col items-center">
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-white whitespace-nowrap">
                    {weekLabel}
                  </h2>
                  {planWeeks.length > 1 && currentPlanWeekIndex >= 0 && (
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 -mt-0.5">
                      Week {currentPlanWeekIndex + 1} of {planWeeks.length}
                    </span>
                  )}
                </div>
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
                      className="text-xs font-medium text-stone-600 dark:text-gray-300 hover:text-primary-500 transition-colors truncate max-w-[160px]"
                      onClick={() => {
                        setEditedPlanTitle(weekPlan.title || '');
                        setIsEditingPlanTitle(true);
                      }}
                      title="Click to rename"
                    >
                      {weekPlan.title || 'Untitled Plan'}
                    </button>
                  )}
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 flex-shrink-0">
                    {STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.label} · {getWeekMealCount(weekPlan.meals, weekDates)} meals
                  </span>
                  {/* Ellipsis menu */}
                  <div className="relative flex-shrink-0" ref={bannerMenuRef}>
                    <button
                      className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 transition-colors"
                      onClick={() => setBannerMenuOpen(!bannerMenuOpen)}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {bannerMenuOpen && (
                      <div className="absolute right-0 top-7 z-50 min-w-[140px] rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-[#16171c] p-1 shadow-xl animate-scale-in">
                        {weekPlan.status === 'draft' && (
                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary-600/70 dark:text-primary-400/70 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            onClick={() => { handleStatusChange(weekPlan.id, 'active'); setBannerMenuOpen(false); }}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start Plan
                          </button>
                        )}
                        {weekPlan.status === 'active' && (
                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-primary-600/70 dark:text-primary-400/70 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            onClick={() => { handleStatusChange(weekPlan.id, 'completed'); setBannerMenuOpen(false); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete
                          </button>
                        )}
                        {weekPlan.status === 'completed' && (
                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                            onClick={() => { handleStatusChange(weekPlan.id, 'active'); setBannerMenuOpen(false); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modify
                          </button>
                        )}
                        <div className="my-0.5 border-t border-stone-100 dark:border-white/[0.06]" />
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
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

              {/* Right: view toggle + settings menu */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center rounded-lg border border-stone-200/80 dark:border-white/[0.08] bg-stone-100/60 dark:bg-white/[0.03] p-0.5">
                  <button
                    className={`p-1.5 rounded-md transition-all duration-200 ${calendarView === 'days' ? 'bg-white dark:bg-white/[0.1] shadow-sm text-primary-500' : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300'}`}
                    onClick={() => setCalendarView('days')}
                    title="Days view"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className={`p-1.5 rounded-md transition-all duration-200 ${calendarView === 'meals' ? 'bg-white dark:bg-white/[0.1] shadow-sm text-primary-500' : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300'}`}
                    onClick={() => setCalendarView('meals')}
                    title="Meals view"
                  >
                    <Rows className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Planner settings — extensible option menu (populated by future MOPs) */}
                <PlannerSettingsMenu options={[]} />
              </div>
            </div>

            {/* Calendar Grid — Days View or Meals View */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500/50" />
              </div>
            ) : calendarView === 'days' ? (
              /* Mobile: horizontally-swipeable day cards (7 columns squeezed
                 to ~50px each was unreadable). Desktop (md+): unchanged
                 7-column grid. Each day's header + card are one unit now so
                 they scroll together. */
              <div className="overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory md:overflow-visible md:mx-0 md:px-0 md:pb-0 md:snap-none">
                <div className="flex gap-2 md:grid md:grid-cols-7">
                  {weekDates.map((date, i) => {
                    const dateStr = formatDateKey(date);
                    const isToday = dateStr === today;
                    const dayMeals = weekPlan?.meals?.[dateStr];

                    return (
                      <div
                        key={dateStr}
                        className="flex-shrink-0 w-[82%] sm:w-[45%] md:w-auto snap-center md:snap-align-none"
                      >
                        {/* Day header */}
                        <div className="text-center pb-1">
                          <p className="text-xs font-medium text-stone-400 dark:text-gray-500 uppercase tracking-widest">
                            {DAYS_SHORT[i]}
                          </p>
                          <p className={`text-lg font-bold mt-0.5 transition-colors ${
                            isToday
                              ? 'text-primary-500'
                              : 'text-stone-700 dark:text-gray-300'
                          }`}>
                            {date.getDate()}
                          </p>
                        </div>

                        <div
                          className={`group relative rounded-2xl border p-2.5 min-h-[220px] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                            isToday
                              ? 'border-primary-500/30 bg-primary-500/[0.03] dark:bg-primary-500/[0.05] shadow-md shadow-primary-500/10 ring-1 ring-primary-500/20'
                              : 'border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-stone-300 dark:hover:border-white/[0.12]'
                          }`}
                        >
                          {/* Today indicator dot */}
                          {isToday && (
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary-500 animate-pulse-slow" />
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
                                            className="flex-shrink-0 opacity-70 md:opacity-0 md:group-hover/meal:opacity-100 text-stone-400 hover:text-destructive transition-all"
                                            onClick={() => handleRemoveMeal(dateStr, slot.key, meal.id)}
                                            title="Remove"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        className="w-full px-2 py-0.5 rounded-lg text-[10px] text-stone-300 dark:text-gray-600 hover:text-primary-500/60 transition-all duration-200 opacity-70 md:opacity-0 md:group-hover/slot:opacity-100"
                                        onClick={() => openRecipeSelector(dateStr, slot.key)}
                                      >
                                        + Add more
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="w-full px-2 py-1 rounded-lg border border-dashed border-stone-200/60 dark:border-white/[0.06] text-[10px] text-stone-300 dark:text-gray-600 hover:border-primary-500/40 hover:text-primary-500/60 hover:bg-primary-500/[0.02] transition-all duration-200 opacity-70 md:opacity-0 md:group-hover/slot:opacity-100 md:group-hover:opacity-60"
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
                      </div>
                    );
                  })}
                </div>
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
                            className="h-7 gap-1 rounded-lg text-xs text-stone-400 hover:text-primary-500"
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
                                className="h-7 gap-1 rounded-lg text-xs text-stone-400 hover:text-primary-500"
                                onClick={() => openRecipeSelector('_snacks', 'snacks')}
                              >
                                <Plus className="h-3 w-3" />
                                Add Snack
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Daily slots: 7-day horizontal grid. Below md this
                           scrolls horizontally at a fixed per-day width
                           instead of squeezing 7 columns into ~50px each. */
                        <div className="overflow-x-auto">
                          <div className="grid grid-cols-7 divide-x divide-stone-100 dark:divide-white/[0.04] min-w-[560px] md:min-w-0">
                          {weekDates.map((date) => {
                            const dateStr = formatDateKey(date);
                            const isToday = dateStr === today;
                            const slotMeals = weekPlan?.meals?.[dateStr]?.[slot.key] || [];

                            return (
                              <div
                                key={dateStr}
                                className={`group p-2 min-h-[80px] transition-colors ${
                                  isToday ? 'bg-primary-500/[0.03] dark:bg-primary-500/[0.05]' : ''
                                }`}
                              >
                                {/* Day label */}
                                <p className={`text-[10px] font-semibold text-center mb-1.5 ${
                                  isToday ? 'text-primary-500' : 'text-stone-400 dark:text-gray-500'
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
                                        className="flex-shrink-0 opacity-70 md:opacity-0 md:group-hover/meal:opacity-100 text-stone-400 hover:text-destructive transition-all"
                                        onClick={() => handleRemoveMeal(dateStr, slot.key, meal.id)}
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  ))}

                                  {/* Add button */}
                                  {weekPlan && (
                                    <button
                                      className="w-full px-1 py-0.5 rounded-md text-[10px] text-stone-300 dark:text-gray-600 hover:text-primary-500/60 hover:bg-primary-500/[0.02] transition-all duration-200 opacity-70 md:opacity-0 md:group-hover:opacity-100"
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Plan-level Lists (Snacks, Non-Recipe Items) */}
            {!isLoading && weekPlan && (() => {
              const visibleLists = calendarView === 'meals'
                ? PLAN_LISTS.filter(l => l.key !== '_snacks')
                : PLAN_LISTS;
              if (visibleLists.length === 0) return null;
              return (
              <div className={`${calendarView === 'meals' ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'} mt-2`}>
                {visibleLists.map((list) => {
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
                            className="h-8 w-8 p-0 rounded-lg text-stone-400 hover:text-primary-500"
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
              );
            })()}

            {/* No Plan CTA */}
            {!isLoading && !weekPlan && (
              <div className="text-center py-12">
                <div className="relative inline-flex mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary-500/8 dark:bg-primary-400/15 flex items-center justify-center">
                    <ChefHat className="w-8 h-8 text-primary-500/60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
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
            <GroceryCart plan={weekPlan} isActive={activeTab === 'grocery'} />
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="mt-6">
            <MealPlanHistory
              plans={historyPlans}
              isLoading={isLoading}
              planMenuOpen={planMenuOpen}
              onPlanMenuToggle={setPlanMenuOpen}
              onCopy={handleCopyPlan}
              onStatusChange={handleStatusChange}
              onDelete={handleDeletePlan}
              copyPending={copyMealPlan.isPending}
              deletePending={deleteMealPlan.isPending}
            />
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

      {/* Day Assignment Modal (after servings) */}
      <DayAssignmentModal
        open={showAssignmentModal}
        recipes={pendingMultiRecipes}
        weekDates={weekDates}
        defaultDate={selectorDate}
        defaultSlot={selectorSlot}
        onConfirm={handleAssignmentConfirmed}
        onClose={() => setShowAssignmentModal(false)}
      />
    </div>
  );
};

export default MealPlanner;
