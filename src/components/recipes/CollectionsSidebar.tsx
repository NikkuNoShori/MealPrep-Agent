import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import {
  useMyCollections,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
  useUnseenShareCount,
  useDashboardStats,
  useSharedWithMe,
  useHouseholdRecipes,
  usePublicRecipes,
} from '@/services/api'
import {
  BookOpen,
  Plus,
  Loader2,
  FolderOpen,
  Trash2,
  Check,
  X,
  Home,
  Globe,
  Pencil,
  MoreVertical,
  Share2,
  Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CollectionsSidebarProps {
  selectedCollectionId: string | null
  onSelectCollection: (collectionId: string | null) => void
  onCollectionNameChange?: (name: string | null) => void
  onViewModeChange?: (mode: 'public' | 'mine' | 'household' | 'shared' | 'collection' | 'all') => void
  viewMode?: 'public' | 'mine' | 'household' | 'shared' | 'collection' | 'all'
}

const visibilityLabels: Record<string, string> = {
  private: 'Private',
  household: 'Household',
  public: 'Public',
}

export const CollectionsSidebar: React.FC<CollectionsSidebarProps> = ({
  selectedCollectionId,
  onSelectCollection,
  onCollectionNameChange,
  onViewModeChange,
  viewMode = 'mine',
}) => {
  const { data: collections, isLoading } = useMyCollections()
  const { data: unseenCount = 0 } = useUnseenShareCount()
  const { data: stats } = useDashboardStats()
  const { data: sharedWithMe } = useSharedWithMe()
  const { data: householdRecipesData } = useHouseholdRecipes({ limit: 1 })
  const { data: publicRecipesData } = usePublicRecipes({ limit: 1 })
  const createCollection = useCreateCollection()
  const deleteCollection = useDeleteCollection()
  const updateCollection = useUpdateCollection()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const handleCreate = () => {
    if (!newName.trim()) return
    createCollection.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => {
          toast.success('Collection created')
          setNewName('')
          setIsCreating(false)
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to create collection')
        },
      }
    )
  }

  const handleDelete = (collectionId: string, name: string) => {
    if (!confirm(`Delete "${name}"? Recipes won't be deleted.`)) return
    setOpenMenuId(null)
    deleteCollection.mutate(collectionId, {
      onSuccess: () => {
        toast.success('Collection deleted')
        if (selectedCollectionId === collectionId) {
          onSelectCollection(null)
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to delete collection')
      },
    })
  }

  const handleCycleVisibility = (collection: any) => {
    const order = ['private', 'household', 'public']
    const currentIdx = order.indexOf(collection.visibility || 'private')
    const next = order[(currentIdx + 1) % order.length]
    setOpenMenuId(null)
    updateCollection.mutate(
      { collectionId: collection.id, updates: { visibility: next } },
      {
        onSuccess: () => {
          toast.success(`Visibility: ${next}`)
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update visibility')
        },
      }
    )
  }

  const handleStartRename = (collection: any) => {
    setOpenMenuId(null)
    setEditingId(collection.id)
    setEditName(collection.name)
  }

  const handleSaveRename = (collectionId: string) => {
    if (!editName.trim() || editName.trim() === editingId) {
      setEditingId(null)
      return
    }
    updateCollection.mutate(
      { collectionId, updates: { name: editName.trim() } },
      {
        onSuccess: () => {
          toast.success('Collection renamed')
          if (selectedCollectionId === collectionId) {
            onCollectionNameChange?.(editName.trim())
          }
          setEditingId(null)
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to rename')
          setEditingId(null)
        },
      }
    )
  }

  const handleCopyLink = (collectionId: string) => {
    const url = `${window.location.origin}/collections/${collectionId}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
    setOpenMenuId(null)
  }

  const handleSelectCollection = (collectionId: string | null, name: string | null) => {
    onSelectCollection(collectionId)
    onCollectionNameChange?.(name)
    if (collectionId) {
      onViewModeChange?.('collection')
    }
  }

  const handleSelectPublic = () => {
    onSelectCollection(null)
    onCollectionNameChange?.(null)
    onViewModeChange?.('public')
  }

  const handleSelectMine = () => {
    onSelectCollection(null)
    onCollectionNameChange?.('My Recipes')
    onViewModeChange?.('mine')
  }

  const handleSelectHousehold = () => {
    onSelectCollection(null)
    onCollectionNameChange?.('Household Recipes')
    onViewModeChange?.('household')
  }

  const handleSelectShared = () => {
    onSelectCollection(null)
    onCollectionNameChange?.('Shared with me')
    onViewModeChange?.('shared')
  }

  const handleSelectAll = () => {
    onSelectCollection(null)
    onCollectionNameChange?.('All Recipes')
    onViewModeChange?.('all')
  }

  const ownCount = stats?.recipeCounts?.ownCount ?? 0
  // Not stats.recipeCounts.householdCount -- that field excludes the
  // current user's own household-visible recipes (by design, for the
  // Dashboard KPI strip's "other members'" framing). This nav item shows
  // ALL household-visible recipes including the user's own, so it needs
  // get_household_recipes()'s own total instead.
  const householdCount = (householdRecipesData as any)?.total ?? 0
  // Not stats.recipeCounts.publicVisibleCount -- same "excludes own" pitfall
  // as householdCount above: that field is a Dashboard-KPI metric that
  // deliberately counts only OTHER users' public recipes (get_dashboard_stats
  // migration 045: `r.user_id != v_user_id`). This nav badge needs to match
  // what clicking "Public" actually shows (getPublicRecipes(), which returns
  // every public recipe the caller can see, including their own) -- confirmed
  // live 2026-10-20: badge showed 1, page showed 50, same root cause as the
  // household-count bug this file already works around.
  const publicCount = (publicRecipesData as any)?.total ?? 0
  const sharedCount = sharedWithMe?.length ?? 0
  // "All Recipes" sums the categories below rather than computing a true
  // deduplicated union (a household recipe can also be public, etc.) — per
  // user decision 2026-10-18, overlap is acceptable here.
  const allCount = ownCount + householdCount + publicCount

  const feedItems = [
    { key: 'all' as const, label: 'All Recipes', icon: BookOpen, handler: handleSelectAll, badge: 0, count: allCount },
    { key: 'mine' as const, label: 'My Recipes', icon: FolderOpen, handler: handleSelectMine, badge: 0, count: ownCount },
    { key: 'household' as const, label: 'Household', icon: Home, handler: handleSelectHousehold, badge: 0, count: householdCount },
    { key: 'shared' as const, label: 'Shared with me', icon: Share2, handler: handleSelectShared, badge: unseenCount as number, count: sharedCount },
    { key: 'public' as const, label: 'Public', icon: Globe, handler: handleSelectPublic, badge: 0, count: publicCount },
  ]

  return (
    <div className="w-full space-y-4">
      {/* Feed Filters */}
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-widest text-fg-muted px-2 mb-2">
          Browse
        </p>
        {feedItems.map((item) => {
          const isActive = viewMode === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.handler}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-brand'
                  : 'text-fg-secondary hover:text-fg'
              }`}
            >
              <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-brand' : ''}`} />
              <span className="truncate flex-1 text-left">{item.label}</span>
              {item.badge > 0 ? (
                <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] font-semibold px-1">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : item.count > 0 ? (
                <span className="shrink-0 text-[11px] tabular-nums text-fg-muted">
                  {item.count > 999 ? '999+' : item.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-surface-200/60 dark:border-white/[0.06]" />

      {/* Collections */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[11px] font-medium uppercase tracking-widest text-fg-muted">
            Collections
          </p>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="text-fg-muted hover:text-brand transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* New collection input */}
        {isCreating && (
          <div className="flex gap-1.5 px-1 mb-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name..."
              className="h-7 text-xs border-input bg-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={createCollection.isPending || !newName.trim()}
              className="shrink-0 text-brand hover:text-primary-600 disabled:text-fg-muted transition-colors"
            >
              {createCollection.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => { setIsCreating(false); setNewName('') }}
              className="shrink-0 text-fg-muted hover:text-fg-secondary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-fg-faint" />
          </div>
        ) : (
          (collections || []).map((collection: any) => {
            const isActive = viewMode === 'collection' && selectedCollectionId === collection.id
            const isDefault = collection.name === 'Favorites'
            const isEditing = editingId === collection.id
            const isMenuOpen = openMenuId === collection.id

            if (isEditing) {
              return (
                <div key={collection.id} className="flex items-center gap-1.5 px-1 py-0.5">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs flex-1 border-input bg-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(collection.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveRename(collection.id)}
                    disabled={updateCollection.isPending}
                    className="shrink-0 text-brand hover:text-primary-600 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="shrink-0 text-fg-muted hover:text-fg-secondary transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            }

            return (
              <div
                key={collection.id}
                className="group relative"
              >
                <button
                  type="button"
                  onClick={() => handleSelectCollection(collection.id, collection.name)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                    isActive
                      ? 'text-brand'
                      : 'text-fg-secondary hover:text-fg'
                  }`}
                >
                  <span className="truncate flex-1 text-left">{collection.name}</span>
                  {collection.recipeCount > 0 && (
                    <span className="shrink-0 text-[11px] tabular-nums text-fg-muted">
                      {collection.recipeCount > 999 ? '999+' : collection.recipeCount}
                    </span>
                  )}
                </button>

                {/* Ellipsis menu trigger */}
                {!isDefault && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2" ref={isMenuOpen ? menuRef : undefined}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : collection.id) }}
                      className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                        isMenuOpen
                          ? 'text-fg-secondary'
                          : 'text-fg-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-fg-muted'
                      }`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute z-[100] top-full right-0 mt-1 origin-top-right animate-scale-in bg-white/95 dark:bg-[rgb(var(--rs-bg-elevated-rgb)/0.95)] backdrop-blur-xl rounded-lg shadow-lg shadow-black/10 dark:shadow-black/30 border border-surface-200/50 dark:border-white/[0.08] py-1 min-w-[150px]">
                        <button
                          onClick={() => handleStartRename(collection)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleCycleVisibility(collection)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {visibilityLabels[collection.visibility || 'private']}
                        </button>
                        {collection.visibility === 'public' && (
                          <button
                            onClick={() => handleCopyLink(collection.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Copy link
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(collection.id, collection.name)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg-muted hover:text-rose-800 dark:hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
