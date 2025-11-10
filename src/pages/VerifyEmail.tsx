import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ToastService } from '@/services/toast'
import { Logger } from '@/services/logger'
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { authService } from '@/services/authService'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verificationCode = searchParams.get('code')
    if (verificationCode) {
      setCode(verificationCode)
      Logger.info('🔵 VerifyEmail: Verification code found in URL', { code: verificationCode })
      // Automatically verify when code is found
      handleVerify(verificationCode)
    } else {
      Logger.warn('⚠️ VerifyEmail: No verification code found in URL')
      setError('Invalid email verification link. Please request a new verification email.')
    }
  }, [searchParams])

  const handleVerify = async (verificationCode: string) => {
    setIsVerifying(true)
    setError(null)
    
    try {
      Logger.info('🔵 VerifyEmail: Verifying email with code', { code: verificationCode })
      
      const result = await authService.verifyEmail(verificationCode)
      
      if (result && result.success) {
        Logger.info('✅ VerifyEmail: Email verified successfully')
        setIsVerified(true)
        ToastService.success('Email verified successfully!')
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { replace: true })
        }, 2000)
      } else {
        throw new Error('Email verification failed')
      }
    } catch (err: any) {
      Logger.error('🔴 VerifyEmail: Email verification error', err)
      const errorMessage = err?.message || 'Failed to verify email. The link may have expired.'
      setError(errorMessage)
      ToastService.error(errorMessage)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendVerification = async () => {
    try {
      // TODO: Implement resend verification email
      ToastService.info('Resend verification email feature coming soon')
    } catch (err: any) {
      Logger.error('🔴 VerifyEmail: Resend verification error', err)
      ToastService.error('Failed to resend verification email')
    }
  }

  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link to="/" className="inline-block">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <span className="text-xl font-bold text-stone-900 dark:text-white">
                  MealPrep Agent
                </span>
              </div>
            </Link>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Email Verified!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-center">
                Your email has been successfully verified. Redirecting to your dashboard...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error && !code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link to="/" className="inline-block">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <span className="text-xl font-bold text-stone-900 dark:text-white">
                  MealPrep Agent
                </span>
              </div>
            </Link>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Invalid Verification Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-center">
                {error}
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={handleResendVerification}
                  variant="outline" 
                  className="w-full"
                >
                  Resend Verification Email
                </Button>
                <Link to="/signin">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold text-stone-900 dark:text-white">
                MealPrep Agent
              </span>
            </div>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Verifying Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isVerifying ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground text-center">
                  Verifying your email address...
                </p>
              </div>
            ) : error ? (
              <>
                <div className="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-muted-foreground text-center">
                  {error}
                </p>
                <div className="space-y-2">
                  <Button 
                    onClick={() => code && handleVerify(code)}
                    variant="outline" 
                    className="w-full"
                  >
                    Try Again
                  </Button>
                  <Button 
                    onClick={handleResendVerification}
                    variant="ghost" 
                    className="w-full"
                  >
                    Resend Verification Email
                  </Button>
                  <Link to="/signin">
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Sign In
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center">
                Please wait while we verify your email...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

