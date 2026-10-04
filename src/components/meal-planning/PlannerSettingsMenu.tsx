/**
 * PlannerSettingsMenu — reusable ellipsis (···) settings dropdown for the
 * Meal Planner page.
 *
 * Accepts an `options` array so new planner-level settings can be added
 * without touching this component. Each option provides a label, icon,
 * description, and click handler (or can be a separator).
 *
 * Usage:
 *   <PlannerSettingsMenu options={[
 *     { id: 'swap-dates', label: 'Swap dates', icon: ArrowLeftRight,
 *       description: 'Swap meals between two days', onClick: handleSwap },
 *   ]} />
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface PlannerSettingOption {
  id: string;
  label: string;
  icon: React.ElementType;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  /** When true, renders a visual separator above this option. */
  separator?: boolean;
}

interface PlannerSettingsMenuProps {
  options: PlannerSettingOption[];
  /** Tooltip shown on the trigger button. Defaults to "Planner settings". */
  title?: string;
  /** Optionally highlight the trigger when a mode is active. */
  active?: boolean;
}

export function PlannerSettingsMenu({
  options,
  title = 'Planner settings',
  active = false,
}: PlannerSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Nothing to show yet (component is an extensible shell awaiting options
  // from future MOPs) — don't render a trigger that opens to an empty popup.
  // This check must come after all hook calls above (Rules of Hooks).
  if (options.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-haspopup="true"
        aria-expanded={open}
        className={[
          'p-1.5 rounded-md transition-all duration-200',
          active || open
            ? 'bg-white dark:bg-white/[0.1] shadow-sm text-primary-500'
            : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300',
        ].join(' ')}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 origin-top-right animate-scale-in
            bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl
            rounded-xl shadow-lg shadow-black/10 dark:shadow-black/30
            border border-stone-200/50 dark:border-white/[0.08]
            py-1.5 min-w-[200px]"
          role="menu"
        >
          {options.map((opt) => (
            <React.Fragment key={opt.id}>
              {opt.separator && (
                <div className="my-1 border-t border-stone-100 dark:border-white/[0.06]" />
              )}
              <button
                role="menuitem"
                disabled={opt.disabled}
                onClick={() => {
                  setOpen(false);
                  opt.onClick();
                }}
                className={[
                  'w-full flex items-start gap-3 px-3 py-2 text-left transition-colors',
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-stone-50 dark:hover:bg-white/[0.05] cursor-pointer',
                ].join(' ')}
              >
                <opt.icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-stone-500 dark:text-stone-400" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-stone-700 dark:text-stone-200 leading-snug">
                    {opt.label}
                  </p>
                  {opt.description && (
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 leading-snug">
                      {opt.description}
                    </p>
                  )}
                </div>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
