import React, { useState } from 'react'
import { X, Share2, Loader2, Check, AlertCircle } from 'lucide-react'
import { useShareRecipe } from '@/services/api'
import toast from 'react-hot-toast'

interface ShareRecipeDialogProps {
  recipeId: string
  recipeTitle: string
  onClose: () => void
}

export const ShareRecipeDialog: React.FC<ShareRecipeDialogProps> = ({
  recipeId,
  recipeTitle,
  onClose,
}) => {
  const [identifier, setIdentifier] = useState('')
  const [shared, setShared] = useState(false)
  const shareRecipe = useShareRecipe()

  const handleShare = async () => {
    const trimmed = identifier.trim()
    if (!trimmed) return
    try {
      await shareRecipe.mutateAsync({ recipeId, targetIdentifier: trimmed })
      setShared(true)
      toast.success(`Shared with ${trimmed}`)
    } catch (err: any) {
      const msg = err?.message || 'Failed to share recipe'
      toast.error(msg.includes('user not found') ? `No user found for "${trimmed}"` : msg)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleShare()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 modal-backdrop backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1b21] border border-surface-200/60 dark:border-white/[0.08] shadow-2xl p-6 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-fg-muted hover:text-fg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-500/10 flex items-center justify-center shrink-0">
            <Share2 className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">Share recipe</h2>
            <p className="text-xs text-fg-muted truncate">{recipeTitle}</p>
          </div>
        </div>

        {shared ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-800 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-fg-secondary text-center">
              Shared with <span className="font-medium">{identifier.trim()}</span>
            </p>
            <button
              onClick={() => { setShared(false); setIdentifier('') }}
              className="text-xs text-brand hover:text-primary-600 transition-colors"
            >
              Share with someone else
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-fg-muted mb-3">
              Enter the username or email address of the person you want to share with.
            </p>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="username or email"
              className="w-full rounded-xl border border-input bg-surface-50 dark:bg-white/[0.03] px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-shadow"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1 text-[11px] text-fg-muted">
                <AlertCircle className="h-3 w-3 shrink-0" />
                They'll see it in "Shared with me"
              </div>
              <button
                onClick={handleShare}
                disabled={!identifier.trim() || shareRecipe.isPending}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {shareRecipe.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Share2 className="h-3.5 w-3.5" />
                )}
                Share
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
