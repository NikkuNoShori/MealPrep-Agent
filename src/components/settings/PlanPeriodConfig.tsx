/**
 * PlanPeriodConfig — MOP-0022
 *
 * Lets the user configure their default meal plan duration and start-day so
 * "New Plan" always pre-fills the right date range without manual picking.
 *
 * Config is stored in profiles.plan_period_config (JSONB).
 * Changes persist immediately on Save; a live preview shows the computed range.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlanStartOn = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'today';

export interface PlanPeriodConfigValue {
  unit: 'weeks' | 'days';
  count: number;           // 1 | 2 | 4 (weeks) or 7 | 14 | 28 (days equivalent)
  startOn: PlanStartOn;
}

export const DEFAULT_PLAN_PERIOD: PlanPeriodConfigValue = {
  unit: 'weeks',
  count: 1,
  startOn: 'monday',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const START_DAY_INDEX: Record<PlanStartOn, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  today: -1, // special: computed dynamically
};

/** Next occurrence of a weekday (0=Sun … 6=Sat) at or after today. */
function nextWeekday(dayIndex: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dayIndex === -1) return today; // "today" mode
  const diff = (dayIndex - today.getDay() + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function computePreview(config: PlanPeriodConfigValue): string {
  const startDayIdx = START_DAY_INDEX[config.startOn];
  const start = nextWeekday(startDayIdx);
  const totalDays = config.unit === 'weeks' ? config.count * 7 : config.count;
  const end = new Date(start);
  end.setDate(start.getDate() + totalDays - 1);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface PlanPeriodConfigProps {
  /** Current saved value from profiles.plan_period_config (null = use default). */
  value: PlanPeriodConfigValue | null;
  onSave: (config: PlanPeriodConfigValue) => Promise<void>;
}

const DURATION_OPTIONS: { label: string; unit: 'weeks'; count: number }[] = [
  { label: '1 week', unit: 'weeks', count: 1 },
  { label: '2 weeks', unit: 'weeks', count: 2 },
  { label: '4 weeks', unit: 'weeks', count: 4 },
];

const START_ON_OPTIONS: { label: string; value: PlanStartOn }[] = [
  { label: 'Sunday', value: 'sunday' },
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: "Today's date", value: 'today' },
];

export function PlanPeriodConfig({ value, onSave }: PlanPeriodConfigProps) {
  const saved = value ?? DEFAULT_PLAN_PERIOD;
  const [staged, setStaged] = useState<PlanPeriodConfigValue>(saved);
  const [saving, setSaving] = useState(false);

  // Sync if parent value changes (e.g. after initial load)
  useEffect(() => { setStaged(value ?? DEFAULT_PLAN_PERIOD); }, [value]);

  const isDirty =
    staged.unit !== saved.unit ||
    staged.count !== saved.count ||
    staged.startOn !== saved.startOn;

  const preview = useMemo(() => computePreview(staged), [staged]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(staged);
      toast.success('Plan period saved');
    } catch {
      toast.error('Failed to save plan period');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Duration picker */}
      <div>
        <Label className="text-sm text-stone-600 dark:text-stone-300">Default duration</Label>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 mb-2">
          Pre-fills the "New Plan" date range each time you create a plan.
        </p>
        <div className="flex gap-2 flex-wrap">
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.count}
              onClick={() => setStaged(s => ({ ...s, unit: opt.unit, count: opt.count }))}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                staged.count === opt.count && staged.unit === opt.unit
                  ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'border-stone-200 dark:border-white/[0.08] text-stone-500 dark:text-stone-400 hover:border-stone-300',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Start-on picker */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-sm text-stone-600 dark:text-stone-300">Starting on</Label>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
            Which day each new plan begins
          </p>
        </div>
        <Select
          value={staged.startOn}
          onValueChange={(v: PlanStartOn) => setStaged(s => ({ ...s, startOn: v }))}
        >
          <SelectTrigger className="w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {START_ON_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live preview */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-white/[0.03] border border-stone-100 dark:border-white/[0.06]">
        <CalendarDays className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 shrink-0" />
        <span className="text-xs text-stone-500 dark:text-stone-400">
          Next plan: <span className="font-medium text-stone-700 dark:text-stone-300">{preview}</span>
        </span>
      </div>

      {/* Save */}
      {isDirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 text-xs">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
