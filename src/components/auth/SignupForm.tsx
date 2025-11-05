import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BackButton } from '@/components/common/BackButton'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ToastService } from '@/services/toast'
import { Logger } from '@/services/logger'
import { Loader2, UserPlus } from 'lucide-react'

interface SignupFormProps {
  onSuccess?: () => void
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { signUp } = useAuthStore()
  
  const signupMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      Logger.info('🔵 SignupForm: Calling signUp...')
      
      // signUp now returns the user directly with retry logic built-in
      const user = await signUp(email, password)
      
      if (!user || !user.id) {
        throw new Error('Sign up successful but user not found. Please try signing in.')
      }
      
      Logger.info('🔵 SignupForm: SignUp successful', { userId: user.id })
      return user
    },
    onSuccess: (user) => {
      Logger.info('🔵 SignupForm: onSuccess called with user', { userId: user.id })
      ToastService.success('Account created successfully!')
      
      // Navigate immediately - user is confirmed
      onSuccess?.()
      navigate('/dashboard', { replace: true })
    },
    onError: (error: any) => {
      const raw = error?.message || ''
      Logger.error('🔴 SignupForm: SignUp error', error)
      
      // Handle different error types
      let friendly = raw || 'Sign up failed'
      
      if (/exists|taken|already/i.test(raw)) {
        friendly = 'An account already exists with this email. Please sign in instead.'
      } else if (/not\s*found|user/i.test(raw)) {
        friendly = 'User not found after sign up. Please try signing in.'
      } else if (/password/i.test(raw)) {
        friendly = 'Password requirements not met. Please check your password.'
      } else if (/email/i.test(raw) && /invalid/i.test(raw)) {
        friendly = 'Invalid email address. Please check your email.'
      }
      
      setError(friendly)
      ToastService.error(friendly)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    signupMutation.mutate({ email, password })
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <p className="text-muted-foreground">Sign up for your account</p>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              autoComplete="new-password"
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
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Sign Up
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
