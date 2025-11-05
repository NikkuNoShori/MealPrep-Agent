import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ToastService } from '@/services/toast'
import { Logger } from '@/services/logger'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('')
  const { requestPasswordReset } = useAuthStore()
  
  const resetMutation = useMutation({
    mutationFn: async (email: string) => {
      Logger.info('🔵 ForgotPasswordForm: Requesting password reset', { email })
      await requestPasswordReset(email)
      Logger.info('🔵 ForgotPasswordForm: Password reset request sent')
    },
    onSuccess: () => {
      ToastService.success(`Password reset email sent to ${email}. Please check your inbox.`)
      setEmail('') // Clear email after success
    },
    onError: (error: any) => {
      const raw = error?.message || ''
      Logger.error('🔴 ForgotPasswordForm: Password reset error', error)
      
      let friendly = raw || 'Failed to send password reset email'
      
      // Check for backend server not running
      if (/backend server|not running/i.test(raw)) {
        friendly = 'Backend server is not running. Please start the server to use password reset. (node server.js)'
      } else if (/not\s*found|no\s*user|invalid/i.test(raw)) {
        friendly = 'No account found with this email address.'
      } else if (/email/i.test(raw) && /invalid/i.test(raw)) {
        friendly = 'Invalid email address. Please check your email.'
      } else if (/Failed to fetch|connection refused/i.test(raw)) {
        friendly = 'Cannot connect to server. Please ensure the backend server is running on port 3000.'
      } else if (/CORS/i.test(raw)) {
        friendly = 'Password reset is currently unavailable. Please try again later.'
      } else if (/404|not found/i.test(raw)) {
        friendly = 'Password reset request failed. Please check your email and try again.'
      } else if (/500|internal server error/i.test(raw)) {
        friendly = 'Server error. Please check server logs and try again later.'
      }
      
      ToastService.error(friendly)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      ToastService.error('Please enter your email address')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ToastService.error('Please enter a valid email address')
      return
    }

    resetMutation.mutate(email)
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
        <p className="text-muted-foreground">
          Enter your email address and we'll send you a link to reset your password
        </p>
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
              placeholder="Enter your email address"
              autoComplete="email"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={resetMutation.isPending}
          >
            {resetMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 w-4 mr-2" />
                Send Reset Link
              </>
            )}
          </Button>

          <div className="text-center pt-4 border-t">
            <Link
              to="/signin"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

