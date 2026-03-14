import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const CompleteSetup: React.FC = () => {
  useDocumentTitle()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuthStore()

  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(false)

  const hasPassword = password.length >= 6
  const canSubmit = displayName.trim().length >= 2 && (hasPassword || googleLinked)

  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
      if (data.url) {
        // Store flag so we know to come back to complete-setup after OAuth
        sessionStorage.setItem('completing_setup', 'true')
        window.location.href = data.url
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to link Google account')
      setIsLinkingGoogle(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return

    if (hasPassword && password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      // Update password if provided
      if (hasPassword) {
        const { error: pwError } = await supabase.auth.updateUser({ password })
        if (pwError) throw pwError
      }

      // Update profile: display_name + setup_completed
      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .update({
          display_name: displayName.trim(),
          setup_completed: true,
        })
        .eq('id', user?.id)

      if (profileError) throw profileError

      await refreshUser()
      toast.success('Account setup complete!')
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete setup')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if Google was just linked (returning from OAuth)
  React.useEffect(() => {
    const wasCompletingSetup = sessionStorage.getItem('completing_setup')
    if (wasCompletingSetup) {
      sessionStorage.removeItem('completing_setup')
      setGoogleLinked(true)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
              MealPrep <span className="text-primary-500">Agent</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/[0.06] dark:shadow-black/30 border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
          <div className="px-8 py-10">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
              Complete Your Account
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8">
              Set your name and choose how you'll sign in.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  required
                  minLength={2}
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">
                    Choose a sign-in method
                  </span>
                </div>
              </div>

              {/* Google Link */}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl h-11 border-gray-200 dark:border-white/10"
                  onClick={handleLinkGoogle}
                  disabled={isLinkingGoogle || googleLinked}
                >
                  {googleLinked ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-emerald-500" />
                      Google Account Linked
                    </>
                  ) : isLinkingGoogle ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>

              {/* Or separator */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500">
                    or set a password
                  </span>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                    minLength={6}
                    disabled={googleLinked}
                  />
                </div>
                {password.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                      minLength={6}
                    />
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>

              {!canSubmit && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  Enter your name and either link Google or set a password to continue.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompleteSetup
