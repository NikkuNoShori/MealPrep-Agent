import React from 'react'
import { cn } from '../../utils/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'glow'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background active:scale-[0.98]',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-px': variant === 'default',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20': variant === 'destructive',
            'border border-stone-200 dark:border-white/10 hover:text-stone-900 dark:hover:text-white hover:border-stone-300 dark:hover:border-white/20 hover:-translate-y-px': variant === 'outline',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
            'hover:text-stone-900 dark:hover:text-white': variant === 'ghost',
            'underline-offset-4 hover:underline text-primary': variant === 'link',
            'bg-[#1D9E75] text-white shadow-lg shadow-[#1D9E75]/25 hover:shadow-xl hover:shadow-[#1D9E75]/30 hover:bg-[#178c66] hover:-translate-y-0.5': variant === 'glow',
          },
          {
            'h-10 py-2 px-4': size === 'default',
            'h-9 px-3 rounded-lg text-xs': size === 'sm',
            'h-12 px-8 rounded-xl text-base': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
