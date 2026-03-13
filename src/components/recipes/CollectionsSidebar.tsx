import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useMyCollections,
  useCreateCollection,
  useDeleteCollection,
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
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CollectionsSidebarProps {
  selectedCollectionId: string | null
  onSelectCollection: (collectionId: string | null) => void
}

const iconMap: Record<string, React.ElementType> = {
  heart: Heart,
  book: BookOpen,
}

export const CollectionsSidebar: React.FC<CollectionsSidebarProps> = ({
  selectedCollectionId,
  onSelectCollection,
}) => {
  const { data: collections, isLoading } = useMyCollections()
  const createCollection = useCreateCollection()
  const deleteCollection = useDeleteCollection()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

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
        {/* All Recipes */}
        <button
          type="button"
          onClick={() => onSelectCollection(null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            selectedCollectionId === null
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'text-foreground hover:bg-accent/50'
          }`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">All Recipes</span>
        </button>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          (collections || []).map((collection: any) => {
            const Icon = iconMap[collection.icon] || FolderOpen
            const isActive = selectedCollectionId === collection.id
            const isDefault = collection.name === 'Favorites' || collection.name === 'My Recipes'

            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => onSelectCollection(collection.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1 text-left">{collection.name}</span>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, collection.id, collection.name)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
