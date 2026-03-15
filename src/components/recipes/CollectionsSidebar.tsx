import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useMyCollections,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from '@/services/api'
import {
  BookOpen,
  Heart,
  Plus,
  Loader2,
  FolderOpen,
  Trash2,
  Check,
  X,
  Lock,
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
  onViewModeChange?: (mode: 'public' | 'mine' | 'household' | 'collection') => void
  viewMode?: 'public' | 'mine' | 'household' | 'collection'
}

const iconMap: Record<string, React.ElementType> = {
  heart: Heart,
  book: BookOpen,
}

const visibilityLabels: Record<string, string> = {
  private: 'Private',
  household: 'Household',
  public: 'Public',
}

const visibilityIcons: Record<string, React.ElementType> = {
  private: Lock,
  household: Home,
  public: Globe,
}

export const CollectionsSidebar: React.FC<CollectionsSidebarProps> = ({
  selectedCollectionId,
  onSelectCollection,
  onCollectionNameChange,
  onViewModeChange,
  viewMode = 'public',
}) => {
  const { data: collections, isLoading } = useMyCollections()
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

  const feedItems = [
    { key: 'public' as const, label: 'Public', icon: Globe, handler: handleSelectPublic },
    { key: 'mine' as const, label: 'My Recipes', icon: FolderOpen, handler: handleSelectMine },
    { key: 'household' as const, label: 'Household', icon: Home, handler: handleSelectHousehold },
  ]

  return (
    <div className="w-full space-y-4">
      {/* Feed Filters */}
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400 dark:text-stone-500 px-2 mb-2">
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
                  ? 'text-[#1D9E75] dark:text-[#34d399]'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#1D9E75] dark:text-[#34d399]' : ''}`} />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1 h-1 rounded-full bg-[#1D9E75] dark:bg-[#34d399]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-stone-200/60 dark:border-white/[0.06]" />

      {/* Collections */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400 dark:text-stone-500">
            Collections
          </p>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="text-stone-400 dark:text-stone-500 hover:text-[#1D9E75] dark:hover:text-[#34d399] transition-colors"
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
              className="h-7 text-xs border-stone-200/60 dark:border-white/[0.08] bg-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsCreating(false)
              }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={createCollection.isPending || !newName.trim()}
              className="shrink-0 text-[#1D9E75] hover:text-[#178c66] disabled:text-stone-300 dark:disabled:text-stone-600 transition-colors"
            >
              {createCollection.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => { setIsCreating(false); setNewName('') }}
              className="shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
          </div>
        ) : (
          (collections || []).map((collection: any) => {
            const Icon = iconMap[collection.icon] || FolderOpen
            const isActive = viewMode === 'collection' && selectedCollectionId === collection.id
            const isDefault = collection.name === 'Favorites'
            const VisIcon = visibilityIcons[collection.visibility || 'private'] || Lock
            const isEditing = editingId === collection.id
            const isMenuOpen = openMenuId === collection.id

            if (isEditing) {
              return (
                <div key={collection.id} className="flex items-center gap-1.5 px-1 py-0.5">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs flex-1 border-stone-200/60 dark:border-white/[0.08] bg-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(collection.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveRename(collection.id)}
                    disabled={updateCollection.isPending}
                    className="shrink-0 text-[#1D9E75] hover:text-[#178c66] transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
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
                      ? 'text-[#1D9E75] dark:text-[#34d399]'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#1D9E75] dark:text-[#34d399]' : ''}`} />
                  <span className="truncate flex-1 text-left">{collection.name}</span>
                  <VisIcon className="h-3 w-3 shrink-0 text-stone-300 dark:text-stone-600" />
                  {isActive && (
                    <div className="w-1 h-1 rounded-full bg-[#1D9E75] dark:bg-[#34d399] shrink-0" />
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
                          ? 'text-stone-700 dark:text-stone-200'
                          : 'text-stone-300 dark:text-stone-600 opacity-0 group-hover:opacity-100 hover:text-stone-500 dark:hover:text-stone-400'
                      }`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute z-[100] top-full right-0 mt-1 origin-top-right animate-scale-in bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl rounded-lg shadow-lg shadow-black/10 dark:shadow-black/30 border border-stone-200/50 dark:border-white/[0.08] py-1 min-w-[150px]">
                        <button
                          onClick={() => handleStartRename(collection)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleCycleVisibility(collection)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {visibilityLabels[collection.visibility || 'private']}
                        </button>
                        {collection.visibility === 'public' && (
                          <button
                            onClick={() => handleCopyLink(collection.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Copy link
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(collection.id, collection.name)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
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
