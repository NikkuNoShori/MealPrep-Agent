import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStackClientApp } from '@/stack/client'
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
      const stackClientApp = getStackClientApp()
      const client = stackClientApp as any

      // Log available methods for debugging
      const availableMethods = Object.getOwnPropertyNames(client).filter(
        name => typeof client[name] === 'function' && 
        (name.toLowerCase().includes('password') || name.toLowerCase().includes('reset'))
      )
      Logger.debug('🔍 ResetPasswordForm: Available password reset methods', { methods: availableMethods })
      
      // Check if updatePassword exists
      const hasUpdatePassword = typeof client.updatePassword === 'function'
      const hasVerifyPasswordResetCode = typeof client.verifyPasswordResetCode === 'function'
      Logger.debug('🔍 ResetPasswordForm: Method availability', { 
        hasUpdatePassword,
        hasVerifyPasswordResetCode,
        canDoTwoStep: hasUpdatePassword && hasVerifyPasswordResetCode
      })

      // Try different Stack Auth password reset methods
      // Method 1: resetPassword({ code, password }) - object parameter with 'password' key
      // The API expects 'password' not 'newPassword'!
      if (typeof client.resetPassword === 'function') {
        Logger.debug('🔵 ResetPasswordForm: Trying resetPassword({ code, password })')
        try {
          const result = await client.resetPassword({ code, password })
          Logger.debug('🔵 ResetPasswordForm: resetPassword result', { result: JSON.stringify(result) })
          
          if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
            const errorMessage = (result as any).error?.message || 
                                (result as any).error?.toString() || 
                                'Failed to reset password'
            Logger.error('🔴 ResetPasswordForm: Password reset failed', { error: errorMessage })
            ToastService.error(errorMessage)
            setIsLoading(false)
            return
          }

          Logger.info('✅ ResetPasswordForm: Password reset successful via resetPassword({ code, password })')
          ToastService.success('Password reset successful! You can now sign in with your new password.')
          onSuccess?.()
          return
        } catch (methodError: any) {
          const errorDetails = {
            message: methodError?.message || 'Unknown error',
            name: methodError?.name,
            stack: methodError?.stack,
            toString: methodError?.toString(),
            fullError: methodError
          }
          Logger.error('🔴 ResetPasswordForm: resetPassword({ code, password }) error', errorDetails)
          Logger.error('🔴 ResetPasswordForm: Full error object', { error: methodError })
        }
      }

      // Method 2: resetPassword(code, newPassword) - two parameters
      if (typeof client.resetPassword === 'function') {
        Logger.debug('🔵 ResetPasswordForm: Trying resetPassword(code, newPassword)')
        try {
          const result = await client.resetPassword(code, password)
          Logger.debug('🔵 ResetPasswordForm: resetPassword(code, password) result', { result: JSON.stringify(result) })
          
          if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
            const errorMessage = (result as any).error?.message || 
                                (result as any).error?.toString() || 
                                'Failed to reset password'
            Logger.error('🔴 ResetPasswordForm: Password reset failed', { error: errorMessage })
            ToastService.error(errorMessage)
            setIsLoading(false)
            return
          }

          Logger.info('✅ ResetPasswordForm: Password reset successful via resetPassword(code, password)')
          ToastService.success('Password reset successful! You can now sign in with your new password.')
          onSuccess?.()
          return
        } catch (methodError: any) {
          const errorDetails = {
            message: methodError?.message || 'Unknown error',
            name: methodError?.name,
            stack: methodError?.stack,
            toString: methodError?.toString(),
            fullError: methodError
          }
          Logger.error('🔴 ResetPasswordForm: resetPassword(code, password) error', errorDetails)
          Logger.error('🔴 ResetPasswordForm: Full error object', { error: methodError })
        }
      }

      // Method 3: resetPasswordWithCode(code, newPassword) - alternative method name
      if (typeof client.resetPasswordWithCode === 'function') {
        Logger.debug('🔵 ResetPasswordForm: Trying resetPasswordWithCode(code, newPassword)')
        try {
          const result = await client.resetPasswordWithCode(code, password)
          Logger.debug('🔵 ResetPasswordForm: resetPasswordWithCode result', { result: JSON.stringify(result) })
          
          if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
            const errorMessage = (result as any).error?.message || 
                                (result as any).error?.toString() || 
                                'Failed to reset password'
            Logger.error('🔴 ResetPasswordForm: Password reset failed', { error: errorMessage })
            ToastService.error(errorMessage)
            setIsLoading(false)
            return
          }

          Logger.info('✅ ResetPasswordForm: Password reset successful via resetPasswordWithCode')
          ToastService.success('Password reset successful! You can now sign in with your new password.')
          onSuccess?.()
          return
        } catch (methodError: any) {
          Logger.debug('⚠️ ResetPasswordForm: resetPasswordWithCode failed', { error: methodError.message })
        }
      }

      // Method 4: verifyPasswordResetCode(code) then updatePassword(password) - two-step process
      // This is likely the correct flow: verify code first, then update password
      if (typeof client.verifyPasswordResetCode === 'function' && typeof client.updatePassword === 'function') {
        Logger.debug('🔵 ResetPasswordForm: Trying verifyPasswordResetCode(code) then updatePassword(password)')
        try {
          // Step 1: Verify the reset code (this may establish a session)
          const verifyResult = await client.verifyPasswordResetCode(code)
          Logger.debug('🔵 ResetPasswordForm: verifyPasswordResetCode(code) result', { result: JSON.stringify(verifyResult) })
          
          if (verifyResult && typeof verifyResult === 'object' && 'status' in verifyResult && verifyResult.status === 'error') {
            const errorMessage = (verifyResult as any).error?.message || 'Code verification failed'
            Logger.error('🔴 ResetPasswordForm: Code verification failed', { error: errorMessage })
            ToastService.error(errorMessage)
            setIsLoading(false)
            return
          }

          // Step 2: Update password using the verified session
          const updateResult = await client.updatePassword(password)
          Logger.debug('🔵 ResetPasswordForm: updatePassword(password) result', { result: JSON.stringify(updateResult) })
          
          if (updateResult && typeof updateResult === 'object' && 'status' in updateResult && updateResult.status === 'error') {
            const errorMessage = (updateResult as any).error?.message || 'Password update failed'
            Logger.error('🔴 ResetPasswordForm: Password update failed', { error: errorMessage })
            ToastService.error(errorMessage)
            setIsLoading(false)
            return
          }

          Logger.info('✅ ResetPasswordForm: Password reset successful via verify + update')
          ToastService.success('Password reset successful! You can now sign in with your new password.')
          onSuccess?.()
          return
        } catch (methodError: any) {
          Logger.error('🔴 ResetPasswordForm: verify + update error', { 
            error: methodError?.message || 'Unknown error',
            name: methodError?.name,
            stack: methodError?.stack,
            fullError: methodError
          })
        }
      } else {
        Logger.debug('⚠️ ResetPasswordForm: Two-step method not available', {
          hasVerifyPasswordResetCode: typeof client.verifyPasswordResetCode === 'function',
          hasUpdatePassword: typeof client.updatePassword === 'function'
        })
      }

      // Method 5: verifyPasswordResetCode(code, newPassword) - verify and reset in one call
      // NOTE: This might only verify the code, not reset the password (based on logs)
      if (typeof client.verifyPasswordResetCode === 'function') {
        Logger.debug('🔵 ResetPasswordForm: Trying verifyPasswordResetCode(code, password)')
        Logger.warn('⚠️ ResetPasswordForm: This method may only verify the code, not reset the password')
        try {
          const result = await client.verifyPasswordResetCode(code, password)
          Logger.debug('🔵 ResetPasswordForm: verifyPasswordResetCode result', { result: JSON.stringify(result) })
          
          if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
            const errorMessage = (result as any).error?.message || 
                                (result as any).error?.toString() || 
                                'Failed to reset password'
            Logger.error('🔴 ResetPasswordForm: Password reset failed', { error: errorMessage })
            ToastService.error(errorMessage)
            setIsLoading(false)
            return
          }

          // WARNING: This method may only verify, not reset
          Logger.warn('⚠️ ResetPasswordForm: verifyPasswordResetCode returned success, but password may not be reset')
          Logger.error('🔴 ResetPasswordForm: Password reset may have failed - verifyPasswordResetCode may only verify, not reset')
          ToastService.error('Password reset completed but may not have worked. Please try signing in, or request a new reset link.')
          setIsLoading(false)
          return
        } catch (methodError: any) {
          Logger.debug('⚠️ ResetPasswordForm: verifyPasswordResetCode failed', { error: methodError.message })
        }
      }

      // If we get here, no method worked
      Logger.error('🔴 ResetPasswordForm: No working password reset method found')
      Logger.debug('🔍 ResetPasswordForm: Client object methods', { 
        allMethods: Object.getOwnPropertyNames(client).filter(name => typeof client[name] === 'function')
      })
      throw new Error('Password reset method not available. Please check Stack Auth configuration.')
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

