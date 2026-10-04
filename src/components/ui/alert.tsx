import React from 'react'
import { cn } from '../../utils/cn'
import { CheckCircle, Info, XCircle } from 'lucide-react'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'info'
}

// Success/info variants point at semantic status tokens instead of hardcoded
// green-*/primary-* Tailwind classes (MOP-0029 Phase 3 / COLOR_SCHEMA.md §5.4).
// `info` intentionally keeps using the brand ramp per COLOR_SCHEMA.md §5.1's
// four status roles (success/error/warning/info) — info has no dedicated
// --status-info token yet (not introduced by this phase), so it stays on
// primary, which is itself preset-aware.
const alertVariants = {
  default: 'border bg-background text-foreground',
  destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
  success: 'border-status-success/50 text-status-success [&>svg]:text-status-success',
  info: 'border-primary-500/50 text-primary-600 dark:text-primary-400 [&>svg]:text-primary-600 dark:[&>svg]:text-primary-400'
}

const alertIcons = {
  default: Info,
  destructive: XCircle,
  success: CheckCircle,
  info: Info
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const Icon = alertIcons[variant]
    
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-lg border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
          alertVariants[variant],
          className
        )}
        {...props}
      >
        <Icon className="h-4 w-4" />
        {children}
      </div>
    )
  }
)

Alert.displayName = 'Alert'

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-sm [&_p]:leading-relaxed', className)}
        {...props}
      />
    )
  }
)

AlertDescription.displayName = 'AlertDescription'
