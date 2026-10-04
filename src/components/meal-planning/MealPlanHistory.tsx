import { useState, useEffect, useRef } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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
  RotateCcw,
  CalendarCheck,
  PackageOpen,
} from 'lucide-react';
import type { MealPlan, MealPlanStatus } from '@/types/mealPlan';
import { MEAL_PLAN_STATUS_ACCENTS } from '@/theme/accentCategories';

// ── Status display config ─────────────────────────────────────────────────────
// Colors/labels/backgrounds come from the single accent-category module
// (MOP-0029 Phase 5 / COLOR_SCHEMA.md §6). Icon component is separate so it
// can be sized at the call site.
const STATUS_CONFIG: Record<MealPlanStatus, {
  label: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
}> = {
  draft:     { ...MEAL_PLAN_STATUS_ACCENTS.draft,     Icon: Clock         },
  active:    { ...MEAL_PLAN_STATUS_ACCENTS.active,    Icon: CalendarCheck },
  completed: { ...MEAL_PLAN_STATUS_ACCENTS.completed, Icon: CheckCircle2  },
  archived:  { ...MEAL_PLAN_STATUS_ACCENTS.archived,  Icon: PackageOpen   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  const startFmt = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFmt   = new Date(end   + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

/** Determine the effective display group for sorting/sectioning. */
function planGroup(plan: MealPlan): 'active' | 'completed' | 'archived' {
  if (plan.status === 'completed') return 'completed';
  if (plan.status === 'archived')  return 'archived';
  return 'active'; // active, draft, or stale active/draft
}

const GROUP_ORDER: Record<string, number> = { active: 0, completed: 1, archived: 2 };

function sortPlans(plans: MealPlan[]): MealPlan[] {
  return [...plans].sort((a, b) => {
    const ga = GROUP_ORDER[planGroup(a)];
    const gb = GROUP_ORDER[planGroup(b)];
    if (ga !== gb) return ga - gb;
    // Within each group: newest end date first
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface MealPlanHistoryProps {
  plans: MealPlan[];
  isLoading: boolean;
  planMenuOpen: string | null;
  onPlanMenuToggle: (planId: string | null) => void;
  onCopy: (planId: string) => void;
  onStatusChange: (planId: string, status: MealPlanStatus) => void;
  onDelete: (planId: string) => void;
  copyPending?: boolean;
  deletePending?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
const MealPlanHistory = ({
  plans,
  isLoading,
  planMenuOpen,
  onPlanMenuToggle,
  onCopy,
  onStatusChange,
  onDelete,
  copyPending,
  deletePending,
}: MealPlanHistoryProps) => {
  const [detailPlan,     setDetailPlan]     = useState<MealPlan | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<MealPlan | null>(null);
  const [completeTarget, setCompleteTarget] = useState<MealPlan | null>(null);
  const wasDeletingRef = useRef(false);

  useEffect(() => {
    if (wasDeletingRef.current && !deletePending) setDeleteTarget(null);
    wasDeletingRef.current = !!deletePending;
  }, [deletePending]);

  useEffect(() => {
    if (!detailPlan) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailPlan(null); };
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
        <h3 className="text-lg font-semibold text-stone-800 dark:text-gray-200 mb-1">No history yet</h3>
        <p className="text-sm text-stone-500 dark:text-gray-400">
          Completed and archived plans will appear here.
        </p>
      </div>
    );
  }

  const sorted = sortPlans(plans);

  return (
    <>
      <div className="space-y-1">
        {sorted.map((plan, idx) => {
          const group     = planGroup(plan);
          const prevGroup = idx > 0 ? planGroup(sorted[idx - 1]) : group;
          const showDivider = idx > 0 && group !== prevGroup;

          const cfg        = STATUS_CONFIG[plan.status] || STATUS_CONFIG.completed;
          const { Icon }   = cfg;
          const mealCount  = countMeals(plan.meals);
          const groceryCount = plan.groceryList?.items?.filter((i) => !i.isRemoved).length || 0;

          return (
            <div key={plan.id}>
              {/* Section divider between groups */}
              {showDivider && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 border-t border-stone-100 dark:border-white/[0.05]" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-600">
                    {group === 'completed' ? 'Completed' : 'Archived'}
                  </span>
                  <div className="flex-1 border-t border-stone-100 dark:border-white/[0.05]" />
                </div>
              )}

              {/* Plan row */}
              <div
                className="group flex items-center justify-between px-4 py-3.5 rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:shadow-md hover:-translate-y-px transition-all duration-300 cursor-pointer mb-2"
                onClick={() => setDetailPlan(plan)}
              >
                {/* Left: status icon + info */}
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl ${cfg.bg} transition-colors flex-shrink-0`}>
                    <Icon className={`h-4.5 w-4.5 ${cfg.color}`} style={{ width: '1.125rem', height: '1.125rem' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800 dark:text-gray-200 leading-snug">
                      {plan.title || 'Untitled Plan'}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
                      {formatDateRange(plan.startDate, plan.endDate)}
                      {mealCount > 0 && (
                        <>
                          <span className="mx-1.5 text-stone-300 dark:text-gray-600">·</span>
                          {mealCount} meals
                        </>
                      )}
                      {groceryCount > 0 && (
                        <>
                          <span className="mx-1.5 text-stone-300 dark:text-gray-600">·</span>
                          {groceryCount} grocery items
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: ellipsis menu */}
                <div
                  className="relative opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                    onClick={() => onPlanMenuToggle(planMenuOpen === plan.id ? null : plan.id)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {planMenuOpen === plan.id && (
                    <div className="absolute right-0 top-9 z-50 min-w-[180px] rounded-xl border border-stone-200/80 dark:border-white/[0.08] bg-white dark:bg-[#16171c] p-1.5 shadow-xl animate-scale-in">

                      {/* Copy to new plan */}
                      <button
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors"
                        onClick={() => { onCopy(plan.id); onPlanMenuToggle(null); }}
                        disabled={copyPending}
                      >
                        <Copy className="h-3.5 w-3.5 flex-shrink-0" />
                        Copy to new plan
                      </button>

                      {/* Restore to active */}
                      {(plan.status === 'completed' || plan.status === 'archived') && (
                        <button
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors"
                          onClick={() => { onStatusChange(plan.id, 'active'); onPlanMenuToggle(null); }}
                        >
                          <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
                          Restore to active
                        </button>
                      )}

                      {/* Archive (completed plans only) */}
                      {plan.status === 'completed' && (
                        <button
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors"
                          onClick={() => { onStatusChange(plan.id, 'archived'); onPlanMenuToggle(null); }}
                        >
                          <Archive className="h-3.5 w-3.5 flex-shrink-0" />
                          Archive
                        </button>
                      )}

                      {/* Mark as complete (stale active/draft) */}
                      {(plan.status === 'draft' || plan.status === 'active') && (
                        <button
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors"
                          onClick={() => { setCompleteTarget(plan); onPlanMenuToggle(null); }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                          Mark as complete
                        </button>
                      )}

                      <div className="my-1 border-t border-stone-100 dark:border-white/[0.06]" />

                      {/* Delete */}
                      <button
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/5 transition-colors"
                        onClick={() => { onPlanMenuToggle(null); setDeleteTarget(plan); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
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

      {/* ── Detail panel ── */}
      {detailPlan && (() => {
        const cfg        = STATUS_CONFIG[detailPlan.status] || STATUS_CONFIG.completed;
        const { Icon }   = cfg;
        const mealCount  = countMeals(detailPlan.meals);
        const groceryItems = detailPlan.groceryList?.items?.filter((i) => !i.isRemoved) ?? [];

        // Build flat meal list: { date, slot, name }[]
        const mealRows: { key: string; name: string }[] = [];
        Object.entries(detailPlan.meals || {}).forEach(([dateKey, val]) => {
          if (!val) return;
          if (dateKey.startsWith('_') && Array.isArray(val)) {
            (val as { id: string; recipeName: string }[]).forEach((e) =>
              mealRows.push({ key: e.id, name: e.recipeName })
            );
          } else if (typeof val === 'object' && !Array.isArray(val)) {
            const day = val as Record<string, { id: string; recipeName: string }[]>;
            Object.entries(day).forEach(([slot, entries]) => {
              (entries || []).forEach((e) =>
                mealRows.push({ key: e.id, name: `${slot[0].toUpperCase() + slot.slice(1)}: ${e.recipeName}` })
              );
            });
          }
        });

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={() => setDetailPlan(null)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Panel */}
            <div
              className="relative w-full max-w-2xl bg-white dark:bg-[#16171c] rounded-2xl shadow-2xl border border-stone-200/80 dark:border-white/[0.08] flex flex-col max-h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-stone-100 dark:border-white/[0.06] flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl ${cfg.bg} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-stone-900 dark:text-white truncate">
                      {detailPlan.title || 'Untitled Plan'}
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      {formatDateRange(detailPlan.startDate, detailPlan.endDate)}
                    </p>
                  </div>
                </div>

                {/* Stats + close */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                    <span className="flex items-center gap-1">
                      <ChefHat className="h-3.5 w-3.5" />
                      {mealCount} meal{mealCount !== 1 ? 's' : ''}
                    </span>
                    {groceryItems.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {groceryItems.length} items
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <button
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                    onClick={() => setDetailPlan(null)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Body — two columns on sm+, stacked on mobile */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-stone-100 dark:divide-white/[0.06]">

                  {/* Meals column */}
                  <div className="p-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3 flex items-center gap-1.5">
                      <ChefHat className="h-3.5 w-3.5" />
                      Meals
                    </h3>
                    {mealRows.length === 0 ? (
                      <p className="text-sm text-stone-400 dark:text-stone-500 italic">No meals recorded.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {mealRows.map((row) => (
                          <div key={row.key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-white/[0.03] border border-stone-100 dark:border-white/[0.04]">
                            <span className="text-sm text-stone-700 dark:text-stone-200 leading-snug">{row.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Grocery column */}
                  <div className="p-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3 flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Grocery list
                    </h3>
                    {groceryItems.length === 0 ? (
                      <p className="text-sm text-stone-400 dark:text-stone-500 italic">No grocery list.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {groceryItems.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                              item.isChecked
                                ? 'bg-stone-50 dark:bg-white/[0.02] border-stone-100 dark:border-white/[0.03] opacity-50'
                                : 'bg-stone-50 dark:bg-white/[0.03] border-stone-100 dark:border-white/[0.04]'
                            }`}
                          >
                            {item.isChecked && (
                              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                            )}
                            <span className={`text-sm leading-snug ${item.isChecked ? 'line-through text-stone-400 dark:text-stone-500' : 'text-stone-700 dark:text-stone-200'}`}>
                              {item.amount != null ? `${item.amount} ` : ''}
                              {item.unit ? `${item.unit} ` : ''}
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-stone-100 dark:border-white/[0.06] flex-shrink-0">
                <div className="flex items-center gap-2">
                  {(detailPlan.status === 'completed' || detailPlan.status === 'archived') && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-white/[0.08] hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors"
                      onClick={() => { onStatusChange(detailPlan.id, 'active'); setDetailPlan(null); }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore to active
                    </button>
                  )}
                  {(detailPlan.status === 'draft' || detailPlan.status === 'active') && (
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-white/[0.08] hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors"
                      onClick={() => { setCompleteTarget(detailPlan); setDetailPlan(null); }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Mark complete
                    </button>
                  )}
                </div>
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50"
                  onClick={() => { onCopy(detailPlan.id); setDetailPlan(null); }}
                  disabled={copyPending}
                >
                  {copyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy to new plan
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Confirm: delete ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete meal plan?"
        description={`"${deleteTarget?.title || 'Untitled Plan'}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete plan"
        isConfirming={deletePending}
        onConfirm={() => deleteTarget && onDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Confirm: mark complete ── */}
      <ConfirmDialog
        open={!!completeTarget}
        title="Mark plan as complete?"
        description={`"${completeTarget?.title || 'Untitled Plan'}" will be moved to history as a completed plan. You can restore it to active from the history menu if needed.`}
        confirmLabel="Mark complete"
        onConfirm={() => {
          if (completeTarget) onStatusChange(completeTarget.id, 'completed');
          setCompleteTarget(null);
        }}
        onCancel={() => setCompleteTarget(null)}
      />
    </>
  );
};

export default MealPlanHistory;
