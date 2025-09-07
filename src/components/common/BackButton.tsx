import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../ui/button'

interface BackButtonProps {
  fallbackPath?: string
  className?: string
  variant?: 'default' | 'ghost' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children?: React.ReactNode
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackPath = '/',
  className = '',
  variant = 'ghost',
  size = 'default',
  children
}) => {
  const navigate = useNavigate()

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      // Fallback to specified path or home
      navigate(fallbackPath)
    }
  }

  return (
    <Button
      onClick={handleBack}
      variant={variant}
      size={size}
      className={`flex items-center gap-2 ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {children || 'Back'}
    </Button>
  )
}

export default BackButton
