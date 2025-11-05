import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BackButton } from '@/components/common/BackButton'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ToastService } from '@/services/toast'
import { Logger } from '@/services/logger'
import { Loader2, LogIn } from 'lucide-react'

interface LoginFormProps {
  onSuccess?: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { signIn } = useAuthStore()
  
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      Logger.info('🔵 LoginForm: Calling signIn...')
      
      // signIn now returns the user directly with retry logic built-in
      const user = await signIn(email, password)
      
      if (!user || !user.id) {
        throw new Error('Sign in successful but user not found. Please try again.')
      }
      
      Logger.info('🔵 LoginForm: SignIn successful', { userId: user.id })
      return user
    },
    onSuccess: (user) => {
      Logger.info('🔵 LoginForm: onSuccess called with user', { userId: user.id })
      ToastService.success('Signed in successfully')
      
      // Navigate immediately - user is confirmed
      onSuccess?.()
      navigate('/dashboard', { replace: true })
    },
    onError: (error: any) => {
      const raw = error?.message || ''
      Logger.error('🔴 LoginForm: SignIn error', error)
      
      const friendly = /not\s*found|no\s*user|invalid/i.test(raw)
        ? 'No account found for this email. Please sign up first.'
        : /password/i.test(raw)
        ? 'Incorrect password. Please try again.'
        : (raw || 'Sign in failed')
      
      setError(friendly)
      ToastService.error(friendly)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    loginMutation.mutate({ email, password })
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <p className="text-muted-foreground">Sign in to your account</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="username"
              required
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
