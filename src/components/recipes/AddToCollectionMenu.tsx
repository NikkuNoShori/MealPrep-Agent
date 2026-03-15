import React, { useState, useRef, useEffect } from 'react'
import {
  useMyCollections,
  useAddRecipeToCollection,
  useRemoveRecipeFromCollection,
  apiClient,
} from '@/services/api'
import { FolderPlus, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface AddToCollectionMenuProps {
  recipeId: string
  size?: 'sm' | 'default'
}

export const AddToCollectionMenu: React.FC<AddToCollectionMenuProps> = ({
  recipeId,
  size = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: collections, isLoading } = useMyCollections()
  const addToCollection = useAddRecipeToCollection()
  const removeFromCollection = useRemoveRecipeFromCollection()

  // Track which collections contain this recipe
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set())
  const [checkingMembership, setCheckingMembership] = useState(false)

  useEffect(() => {
    if (!isOpen || !collections || collections.length === 0) return

    // Check membership for each collection
    setCheckingMembership(true)
    const checkAll = async () => {
      const membership = new Set<string>()
      // We'll rely on the collection_recipes query for each collection
      // For efficiency, we use a simple approach: query all collections' recipes
      for (const col of collections) {
        try {
          const recipes = await apiClient.getCollectionRecipes(col.id)
          if (recipes.some((cr: any) => cr.recipeId === recipeId)) {
            membership.add(col.id)
          }
        } catch {
          // ignore errors
        }
      }
      setMemberOf(membership)
      setCheckingMembership(false)
    }
    checkAll()
  }, [isOpen, collections, recipeId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = (collectionId: string, collectionName: string) => {
    if (memberOf.has(collectionId)) {
      removeFromCollection.mutate(
        { collectionId, recipeId },
        {
          onSuccess: () => {
            setMemberOf((prev) => {
              const next = new Set(prev)
              next.delete(collectionId)
              return next
            })
            toast.success(`Removed from ${collectionName}`)
          },
          onError: (err: any) => toast.error(err?.message || 'Failed to remove'),
        }
      )
    } else {
      addToCollection.mutate(
        { collectionId, recipeId },
        {
          onSuccess: () => {
            setMemberOf((prev) => new Set(prev).add(collectionId))
            toast.success(`Added to ${collectionName}`)
          },
          onError: (err: any) => toast.error(err?.message || 'Failed to add'),
        }
      )
    }
  }

  const isSmall = size === 'sm'

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 backdrop-blur-sm shadow-sm transition-all duration-200 hover:border-[#1D9E75]/40 hover:text-[#1D9E75] dark:hover:text-[#34d399] active:scale-[0.97] ${
          isSmall ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'
        } ${isOpen ? 'border-[#1D9E75]/50 shadow-md ring-1 ring-[#1D9E75]/20' : ''}`}
        title="Add to collection"
      >
        <FolderPlus className={`${isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-muted-foreground`} />
        {!isSmall && <span className="font-medium">Collect</span>}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-52 rounded-lg border border-stone-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl shadow-lg shadow-black/10 dark:shadow-black/30 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-1.5">
            <div className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collections
            </div>
            {isLoading || checkingMembership ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !collections || collections.length === 0 ? (
              <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                No collections yet
              </div>
            ) : (
              collections.map((collection: any) => {
                const isIn = memberOf.has(collection.id)
                return (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => handleToggle(collection.id, collection.name)}
                    disabled={addToCollection.isPending || removeFromCollection.isPending}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150 ${
                      isIn
                        ? 'text-[#1D9E75] dark:text-[#34d399]'
                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors duration-150 ${
                      isIn
                        ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                        : 'border-border/80'
                    }`}>
                      {isIn && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate font-medium">{collection.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
