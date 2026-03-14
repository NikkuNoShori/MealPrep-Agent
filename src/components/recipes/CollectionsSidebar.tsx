import React, { useState } from 'react'
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
  Link as LinkIcon,
  Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CollectionsSidebarProps {
  selectedCollectionId: string | null
  onSelectCollection: (collectionId: string | null) => void
  onCollectionNameChange?: (name: string | null) => void
  onViewModeChange?: (mode: 'public' | 'mine' | 'collection') => void
  viewMode?: 'public' | 'mine' | 'collection'
}

const iconMap: Record<string, React.ElementType> = {
  heart: Heart,
  book: BookOpen,
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

  const handleDelete = (e: React.MouseEvent, collectionId: string, name: string) => {
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? Recipes won't be deleted.`)) return
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

  const handleCycleVisibility = (e: React.MouseEvent, collection: any) => {
    e.stopPropagation()
    const order = ['private', 'household', 'public']
    const currentIdx = order.indexOf(collection.visibility || 'private')
    const next = order[(currentIdx + 1) % order.length]
    updateCollection.mutate(
      { collectionId: collection.id, updates: { visibility: next } },
      {
        onSuccess: () => {
          toast.success(`Collection set to ${next}`)
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update visibility')
        },
      }
    )
  }

  const handleStartRename = (e: React.MouseEvent, collection: any) => {
    e.stopPropagation()
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

  const handleCopyLink = (e: React.MouseEvent, collectionId: string) => {
    e.stopPropagation()
    const url = `${window.location.origin}/collections/${collectionId}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setIsCreating(!isCreating)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* New collection input */}
      {isCreating && (
        <div className="flex gap-1.5 mb-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Collection name"
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setIsCreating(false)
            }}
            autoFocus
          />
          <Button
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={handleCreate}
            disabled={createCollection.isPending || !newName.trim()}
          >
            {createCollection.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={() => { setIsCreating(false); setNewName('') }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="space-y-0.5">
        {/* Public Recipes */}
        <button
          type="button"
          onClick={handleSelectPublic}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            viewMode === 'public'
              ? 'bg-primary/15 text-primary dark:bg-primary/25 shadow-sm ring-1 ring-primary/20'
              : 'text-foreground hover:bg-accent/50'
          }`}
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="truncate">Public Recipes</span>
        </button>

        {/* My Recipes */}
        <button
          type="button"
          onClick={handleSelectMine}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            viewMode === 'mine'
              ? 'bg-primary/15 text-primary dark:bg-primary/25 shadow-sm ring-1 ring-primary/20'
              : 'text-foreground hover:bg-accent/50'
          }`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">My Recipes</span>
        </button>

        {/* Divider */}
        <div className="border-t border-border/40 my-2" />

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          (collections || []).map((collection: any) => {
            const Icon = iconMap[collection.icon] || FolderOpen
            const isActive = viewMode === 'collection' && selectedCollectionId === collection.id
            const isDefault = collection.name === 'Favorites'
            const VisIcon = visibilityIcons[collection.visibility || 'private'] || Lock
            const isEditing = editingId === collection.id

            if (isEditing) {
              return (
                <div key={collection.id} className="flex gap-1 px-1 py-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(collection.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => handleSaveRename(collection.id)}
                    disabled={updateCollection.isPending}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )
            }

            return (
              <div
                key={collection.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectCollection(collection.id, collection.name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCollection(collection.id, collection.name) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer ${
                  isActive
                    ? 'bg-primary/15 text-primary dark:bg-primary/25 shadow-sm ring-1 ring-primary/20'
                    : 'text-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1 text-left">{collection.name}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Rename */}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(e, collection)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all duration-150"
                      title="Rename collection"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  {/* Visibility toggle */}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={(e) => handleCycleVisibility(e, collection)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all duration-150"
                      title={`Visibility: ${collection.visibility || 'private'}`}
                    >
                      <VisIcon className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  {/* Share link (public only) */}
                  {collection.visibility === 'public' && (
                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(e, collection.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all duration-150"
                      title="Copy share link"
                    >
                      <LinkIcon className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  {/* Delete */}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, collection.id, collection.name)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
