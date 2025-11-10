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
import { authService } from '@/services/authService'

interface SignupFormProps {
  onSuccess?: () => void
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSuccess }) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { signUp } = useAuthStore()
  
  const signupMutation = useMutation({
    mutationFn: async ({ firstName, lastName, email, password }: { firstName: string; lastName: string; email: string; password: string }) => {
      Logger.info('🔵 SignupForm: Calling signUp...')
      
      // signUp now returns the user directly with retry logic built-in
      const user = await signUp(firstName, lastName, email, password)
      
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
    
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields')
      return
    }

    if (!firstName.trim()) {
      setError('First name is required')
      return
    }

    if (!lastName.trim()) {
      setError('Last name is required')
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

    signupMutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password })
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
        <p className="text-muted-foreground">Sign up for your account</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                autoComplete="given-name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                autoComplete="family-name"
                required
              />
            </div>
          </div>

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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              try {
                await authService.signInWithGoogle();
              } catch (error: any) {
                setError(error.message || 'Failed to sign in with Google');
                ToastService.error(error.message || 'Failed to sign in with Google');
              }
            }}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

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
