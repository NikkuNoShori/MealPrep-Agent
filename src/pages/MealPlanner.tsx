import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Utensils,
  ChefHat,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Archive,
  CheckCircle2,
  FileText,
  Sparkles,
  Sun,
  Coffee,
  Moon,
  Cookie,
  X,
  Pencil,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { MealPlanStatus, MealSlot, PlannedMealEntry } from '@/types/mealPlan';
import RecipePickerModal from '@/components/meal-planning/RecipePickerModal';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MEAL_SLOTS: { key: MealSlot; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'text-amber-500' },
  { key: 'lunch', label: 'Lunch', icon: Sun, color: 'text-orange-500' },
  { key: 'dinner', label: 'Dinner', icon: Moon, color: 'text-indigo-500' },
  { key: 'snacks', label: 'Snacks', icon: Cookie, color: 'text-pink-500' },
];

const STATUS_CONFIG: Record<MealPlanStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  active: { label: 'Active', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  completed: { label: 'Done', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
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
    (dayMeals.dinner?.length || 0) +
    (dayMeals.snacks?.length || 0);
}

function getWeekMealCount(meals: any, weekDates: Date[]): number {
  return weekDates.reduce((sum, d) => sum + getMealCount(meals, formatDateKey(d)), 0);
}

const MealPlanner = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [planMenuOpen, setPlanMenuOpen] = useState<string | null>(null);
  const [isEditingPlanTitle, setIsEditingPlanTitle] = useState(false);
  const [editedPlanTitle, setEditedPlanTitle] = useState('');
  const [bannerMenuOpen, setBannerMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState('');
  const [pickerSlot, setPickerSlot] = useState<MealSlot>('dinner');
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

  const weekLabel = `${currentWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-primary-50/20 to-secondary-50/20 dark:from-slate-900 dark:via-gray-900 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white">
              Meal Planner
            </h1>
            <p className="text-stone-500 dark:text-gray-400 mt-1">
              Plan meals, build grocery lists, eat better.
            </p>
          </div>
          {!weekPlan && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          )}
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'This Week',
              value: weekPlan ? getWeekMealCount(weekPlan.meals, weekDates) : 0,
              suffix: 'meals',
              hint: weekPlan ? 'View calendar' : 'Create a plan',
              icon: Utensils,
              gradient: 'from-emerald-500 to-teal-600',
              glow: 'shadow-emerald-500/20',
              onClick: () => {
                if (weekPlan) {
                  setActiveTab('calendar');
                } else {
                  setShowCreateForm(true);
                }
              },
            },
            {
              label: 'Plan Status',
              value: weekPlan ? STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.label || weekPlan.status : 'None',
              hint: weekPlan
                ? weekPlan.status === 'draft' ? 'Click to start'
                : weekPlan.status === 'active' ? 'Click to complete'
                : weekPlan.status === 'completed' ? 'Click to modify'
                : ''
                : 'No plan yet',
              icon: FileText,
              gradient: 'from-blue-500 to-indigo-600',
              glow: 'shadow-blue-500/20',
              onClick: () => {
                if (!weekPlan) return;
                if (weekPlan.status === 'draft') handleStatusChange(weekPlan.id, 'active');
                else if (weekPlan.status === 'active') handleStatusChange(weekPlan.id, 'completed');
                else if (weekPlan.status === 'completed') handleStatusChange(weekPlan.id, 'active');
              },
            },
            {
              label: 'Grocery Items',
              value: weekPlan?.groceryList?.items?.filter((i: any) => !i.isRemoved)?.length || 0,
              suffix: 'items',
              hint: 'View grocery cart',
              icon: ShoppingCart,
              gradient: 'from-amber-500 to-orange-600',
              glow: 'shadow-amber-500/20',
              onClick: () => setActiveTab('grocery'),
            },
            {
              label: 'Total Plans',
              value: mealPlans?.length || 0,
              suffix: 'saved',
              hint: 'View history',
              icon: Calendar,
              gradient: 'from-violet-500 to-purple-600',
              glow: 'shadow-violet-500/20',
              onClick: () => setActiveTab('history'),
            },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className={`stat-card group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] bg-white dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/[0.06] shadow-sm hover:shadow-lg ${stat.glow} cursor-pointer`}
            >
              <div className={`absolute top-0 right-0 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} opacity-[0.06] dark:opacity-[0.08] -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500`} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs font-medium text-stone-500 dark:text-gray-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-white mt-1">
                    {stat.value}
                    {stat.suffix && (
                      <span className="text-xs font-normal text-stone-400 dark:text-gray-500 ml-1">{stat.suffix}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {stat.hint}
                  </p>
                </div>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg ${stat.glow} group-hover:shadow-xl transition-shadow duration-300`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Create Plan Form ── */}
        {showCreateForm && (
          <Card className="border-primary/20 shadow-lg shadow-primary/5 animate-slide-up">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary/25">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-white">New Meal Plan</h3>
                  <p className="text-xs text-stone-500 dark:text-gray-400">
                    For {weekLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label htmlFor="plan-title" className="text-xs font-medium">Plan Title (optional)</Label>
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
                <Button variant="ghost" onClick={() => { setShowCreateForm(false); setNewPlanTitle(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto gap-1 p-1.5 rounded-xl bg-stone-100/80 dark:bg-white/[0.04] border border-stone-200/60 dark:border-white/[0.06]">
            <TabsTrigger value="calendar" className="gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 data-[state=active]:shadow-md">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="grocery" className="gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 data-[state=active]:shadow-md">
              <ShoppingCart className="h-4 w-4" />
              Grocery Cart
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 data-[state=active]:shadow-md">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* ── Calendar Tab ── */}
          <TabsContent value="calendar" className="mt-6 space-y-4">
            {/* Week Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
                className="gap-1.5 rounded-xl hover:shadow-md transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-stone-900 dark:text-white">
                  {weekLabel}
                </h2>
                {weekPlan && (
                  <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
                    {weekPlan.title || 'Untitled Plan'}
                    <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.bg} ${STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.color}`}>
                      {STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.label}
                    </span>
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
                className="gap-1.5 rounded-xl hover:shadow-md transition-all duration-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Active Plan Banner */}
            {weekPlan && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.04] to-transparent dark:from-primary/[0.06] dark:to-transparent animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.bg}`}>
                    <FileText className={`h-4 w-4 ${STATUS_CONFIG[weekPlan.status as MealPlanStatus]?.color}`} />
                  </div>
                  <div>
                    {isEditingPlanTitle ? (
                      <div ref={titleEditRef} className="flex items-center gap-2">
                        <Input
                          ref={titleInputRef}
                          value={editedPlanTitle}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedPlanTitle(e.target.value)}
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') handleSavePlanTitle();
                            if (e.key === 'Escape') setIsEditingPlanTitle(false);
                          }}
                          className="h-7 text-sm w-48"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-2 group/title"
                        onClick={() => {
                          setEditedPlanTitle(weekPlan.title || '');
                          setIsEditingPlanTitle(true);
                        }}
                      >
                        <p className="text-sm font-semibold text-stone-800 dark:text-gray-200 group-hover/title:text-primary transition-colors">
                          {weekPlan.title || 'Untitled Plan'}
                        </p>
                      </button>
                    )}
                    <p className="text-[11px] text-stone-500 dark:text-gray-400">
                      {getWeekMealCount(weekPlan.meals, weekDates)} meals planned
                      {weekPlan.notes && <span className="ml-1.5">· {weekPlan.notes}</span>}
                    </p>
                  </div>
                </div>
                <div className="relative" ref={bannerMenuRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-gray-300"
                    onClick={() => setBannerMenuOpen(!bannerMenuOpen)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {bannerMenuOpen && (
                    <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-gray-900 p-1.5 shadow-xl animate-scale-in">
                      {weekPlan.status === 'draft' && (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors text-emerald-600 dark:text-emerald-400"
                          onClick={() => { handleStatusChange(weekPlan.id, 'active'); setBannerMenuOpen(false); }}
                        >
                          <Play className="h-4 w-4" />
                          Start Plan
                        </button>
                      )}
                      {weekPlan.status === 'active' && (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors text-blue-600 dark:text-blue-400"
                          onClick={() => { handleStatusChange(weekPlan.id, 'completed'); setBannerMenuOpen(false); }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Complete
                        </button>
                      )}
                      {weekPlan.status === 'completed' && (
                        <button
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-white/[0.04] transition-colors"
                          onClick={() => { handleStatusChange(weekPlan.id, 'active'); setBannerMenuOpen(false); }}
                        >
                          <Pencil className="h-4 w-4" />
                          Modify
                        </button>
                      )}
                      <div className="my-1 border-t border-stone-100 dark:border-white/[0.06]" />
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                        onClick={() => { handleStatusChange(weekPlan.id, 'archived'); setBannerMenuOpen(false); }}
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            ) : (
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
                          ? 'text-primary'
                          : 'text-stone-700 dark:text-gray-300'
                      }`}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}

                {/* Day Columns */}
                {weekDates.map((date, i) => {
                  const dateStr = formatDateKey(date);
                  const isToday = dateStr === today;
                  const dayMeals = weekPlan?.meals?.[dateStr];

                  return (
                    <div
                      key={dateStr}
                      className={`group relative rounded-2xl border p-2.5 min-h-[220px] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                        isToday
                          ? 'border-primary/30 bg-primary/[0.03] dark:bg-primary/[0.05] shadow-md shadow-primary/10 ring-1 ring-primary/20'
                          : 'border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-stone-300 dark:hover:border-white/[0.12]'
                      }`}
                    >
                      {/* Today indicator dot */}
                      {isToday && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse-slow" />
                      )}

                      <div className="space-y-1.5">
                        {MEAL_SLOTS.map((slot) => {
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
                                slotMeals.map((meal: any) => (
                                  <div
                                    key={meal.id}
                                    className="px-2 py-1 rounded-lg bg-stone-50 dark:bg-white/[0.04] border border-stone-100 dark:border-white/[0.06] text-xs text-stone-700 dark:text-gray-300 truncate transition-all duration-200 hover:bg-stone-100 dark:hover:bg-white/[0.08] hover:shadow-sm cursor-default"
                                    title={meal.recipeName}
                                  >
                                    {meal.recipeName}
                                  </div>
                                ))
                              ) : (
                                <button
                                  className="w-full px-2 py-1 rounded-lg border border-dashed border-stone-200/60 dark:border-white/[0.06] text-[10px] text-stone-300 dark:text-gray-600 hover:border-primary/40 hover:text-primary/60 hover:bg-primary/[0.02] transition-all duration-200 opacity-0 group-hover/slot:opacity-100 group-hover:opacity-60"
                                  onClick={() => {
                                    // TODO: Open recipe picker (P1)
                                    toast('Recipe picker coming in P1', { icon: '🍳' });
                                  }}
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
            )}

            {/* No Plan CTA */}
            {!isLoading && !weekPlan && (
              <div className="text-center py-12">
                <div className="relative inline-flex mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center">
                    <ChefHat className="w-8 h-8 text-primary/60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center shadow-lg shadow-primary/30">
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
                    {weekPlan
                      ? 'Add recipes to your meal plan and the grocery list will be generated automatically.'
                      : 'Create a meal plan first, then add recipes to generate your grocery list.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="mt-6 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
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
    </div>
  );
};

export default MealPlanner;
