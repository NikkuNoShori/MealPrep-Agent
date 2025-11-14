import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { ToastService } from '@/services/toast'
import { Logger } from '@/services/logger'
import { Loader2, Lock } from 'lucide-react'

interface ResetPasswordFormProps {
  code: string
  onSuccess?: () => void
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ code, onSuccess }) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      ToastService.error('Please enter a new password')
      return
    }

    if (password.length < 8) {
      ToastService.error('Password must be at least 8 characters long')
      return
    }

    if (password !== confirmPassword) {
      ToastService.error('Passwords do not match')
      return
    }

    setIsLoading(true)
    Logger.info('🔵 ResetPasswordForm: Resetting password with code', { code })

    try {
      // Supabase Auth: Password reset flow
      // The code is the OTP token from the password reset email
      // First, verify the OTP code, then update the password
      
      // Method 1: Verify OTP and update password in one call
      // Supabase's verifyOtp with type='recovery' handles password reset
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: code,
        type: 'recovery'
      })

      if (verifyError) {
        Logger.error('🔴 ResetPasswordForm: OTP verification failed', { error: verifyError.message })
        ToastService.error(verifyError.message || 'Invalid or expired reset code')
        setIsLoading(false)
        return
      }

      // After verifying OTP, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        Logger.error('🔴 ResetPasswordForm: Password update failed', { error: updateError.message })
        ToastService.error(updateError.message || 'Failed to update password')
        setIsLoading(false)
        return
      }

      Logger.info('✅ ResetPasswordForm: Password reset successful')
      ToastService.success('Password reset successful! You can now sign in with your new password.')
      onSuccess?.()
    } catch (error: any) {
      Logger.error('🔴 ResetPasswordForm: Password reset error', error)
      const errorMessage = error?.message || error?.toString() || 'Failed to reset password'
      ToastService.error(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
        <p className="text-muted-foreground">
          Enter your new password below
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting Password...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Reset Password
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

