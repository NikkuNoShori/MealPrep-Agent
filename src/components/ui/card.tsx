import { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'interactive' | 'glass'
}

export const Card: React.FC<CardProps> = ({ children, className = '', variant = 'default' }) => {
  return (
    <div className={cn(
      variant === 'glass' ? 'card-glass' : variant === 'interactive' ? 'card-interactive' : 'card',
      className
    )}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={cn('pb-4', className)}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 dark:text-white', className)}>
      {children}
    </h3>
  )
}

interface CardDescriptionProps {
  children: ReactNode
  className?: string
}

export const CardDescription: React.FC<CardDescriptionProps> = ({ children, className = '' }) => {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  )
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
