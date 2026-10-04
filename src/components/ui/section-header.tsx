import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

/**
 * SectionHeader — shared primitive for section/widget headers (MOP-0029
 * Phase 6 / COLOR_SCHEMA.md §3 category 4, "Widget / section headers").
 *
 * Generalizes the header pattern already used identically across all four
 * Dashboard widgets (TodayWidget, GroceryCartWidget, MostCookedWidget,
 * TopCuisinesWidget): an italic Fraunces-serif title, an optional trailing
 * action (a "View all" / "Open cart"-style link), and a dashed bottom border
 * that visually separates the header from the section body — real
 * background/border differentiation, unlike `CardHeader` (src/components/ui/
 * card.tsx), which today is padding-only with no visual distinction of its
 * own.
 *
 * Scope note: this phase introduces the primitive and applies it to two
 * call sites to prove it isn't dead code (see TodayWidget.tsx,
 * GroceryCartWidget.tsx). Migrating the other ~56 ad hoc section-header
 * stylings onto it (RecipeList, MealPlanHistory, MealPlanner, etc.) is
 * explicitly deferred — those instances vary enough in surrounding markup
 * (some wrap a search box, some a filter row) that a mechanical swap risks
 * layout regressions better handled as their own reviewed change.
 */

interface SectionHeaderAction {
  label: string
  /** Internal route — rendered as a react-router `Link`. */
  to?: string
  /** External URL or non-router navigation — rendered as an `<a>`. */
  href?: string
  onClick?: () => void
  /** Override the default hover accent (e.g. `hover:text-teal-500
   *  dark:hover:text-teal-400`) — different widgets pair their action link
   *  with different accent colors (GroceryCartWidget: teal, TodayWidget:
   *  primary). Merged over the base classes via `cn`/twMerge. */
  className?: string
}

interface SectionHeaderProps {
  /** Section title. Rendered in the app's established italic Fraunces-serif
   *  label style used for widget/section headers. */
  title: ReactNode
  /** Optional trailing action link/button (e.g. "View all", "Open cart"). */
  action?: SectionHeaderAction
  /** Optional extra content instead of / alongside `action` (e.g. a custom
   *  button, a count badge). Rendered after `action` if both are given. */
  trailing?: ReactNode
  /** Additional classes for the outer wrapper. */
  className?: string
  /** Additional classes for the `<h2>` title element. */
  titleClassName?: string
  /** Omit the dashed bottom border — for callers that want just the title
   *  row (e.g. when the section body supplies its own divider). */
  divider?: boolean
}

/** The italic Fraunces-serif label style shared by every section header. */
const TITLE_CLASSES =
  'text-sm font-semibold italic text-surface-800 dark:text-gray-200'

const ACTION_CLASSES =
  'text-xs text-surface-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors'

function SectionHeaderAction({ action }: { action: SectionHeaderAction }) {
  const style = { fontFamily: "'DM Sans', sans-serif" }
  const classes = cn(ACTION_CLASSES, action.className)

  if (action.to) {
    return (
      <Link to={action.to} className={classes} style={style}>
        {action.label}
      </Link>
    )
  }

  if (action.href) {
    return (
      <a href={action.href} className={classes} style={style}>
        {action.label}
      </a>
    )
  }

  return (
    <button type="button" onClick={action.onClick} className={classes} style={style}>
      {action.label}
    </button>
  )
}

export function SectionHeader({
  title,
  action,
  trailing,
  className = '',
  titleClassName = '',
  divider = true,
}: SectionHeaderProps) {
  return (
    <div className={cn(divider && 'border-b border-dashed border-surface-200 dark:border-white/[0.08] pb-3 mb-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn(TITLE_CLASSES, titleClassName)} style={{ fontFamily: "'Fraunces', serif" }}>
          {title}
        </h2>
        {(action || trailing) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {action && <SectionHeaderAction action={action} />}
            {trailing}
          </div>
        )}
      </div>
    </div>
  )
}
