import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Users, Star, ChefHat, Edit, Trash2 } from 'lucide-react'

interface RecipeCardProps {
  recipe: {
    id: string
    title: string
    description?: string
    prepTime?: number
    cookTime?: number
    servings?: number
    difficulty?: 'easy' | 'medium' | 'hard'
    tags?: string[]
    imageUrl?: string
    rating?: number
    familyPreferences?: { [memberId: string]: 'love' | 'like' | 'neutral' | 'dislike' }
  }
  viewMode: 'grid' | 'list'
  onClick?: () => void
  onEdit?: (recipe: any) => void
  onDelete?: (recipeId: string) => void
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ 
  recipe, 
  viewMode, 
  onClick,
  onEdit,
  onDelete
}) => {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getFamilyConsensus = () => {
    if (!recipe.familyPreferences) return null
    
    const preferences = Object.values(recipe.familyPreferences)
    const loves = preferences.filter(p => p === 'love').length
    const likes = preferences.filter(p => p === 'like').length
    const dislikes = preferences.filter(p => p === 'dislike').length
    
    if (loves > likes && loves > dislikes) return 'love'
    if (likes > loves && likes > dislikes) return 'like'
    if (dislikes > loves && dislikes > likes) return 'dislike'
    return 'neutral'
  }

  const familyConsensus = getFamilyConsensus()

  if (viewMode === 'list') {
    return (
      <div onClick={onClick} className="group">
        <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 group-hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              {/* Enhanced Recipe Image */}
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex-shrink-0 overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                {recipe.imageUrl ? (
                  <img 
                    src={recipe.imageUrl} 
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
                {familyConsensus && (
                  <div className="absolute -top-2 -right-2">
                    <Badge 
                      variant={familyConsensus === 'love' ? 'default' : 'secondary'}
                      className="text-xs shadow-lg"
                    >
                      {familyConsensus === 'love' && <Star className="h-3 w-3 mr-1" />}
                      {familyConsensus}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Enhanced Recipe Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mt-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(recipe)
                        }}
                        className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      >
                        <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(recipe.id)
                        }}
                        className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Enhanced Recipe Meta */}
                <div className="flex items-center gap-6 mb-3">
                  {totalTime > 0 && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-medium">{totalTime} min</span>
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="font-medium">{recipe.servings} servings</span>
                    </div>
                  )}
                  {recipe.rating && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                      <span className="font-medium">{recipe.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Enhanced Tags and Difficulty */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {recipe.difficulty && (
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-medium ${getDifficultyColor(recipe.difficulty)} border-0`}
                      >
                        {recipe.difficulty}
                      </Badge>
                    )}
                    {recipe.tags && recipe.tags.length > 0 && (
                      <div className="flex gap-1">
                        {recipe.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {tag}
                          </Badge>
                        ))}
                        {recipe.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            +{recipe.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Grid view
  return (
    <div onClick={onClick} className="group h-full">
      <Card className="cursor-pointer hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 h-full group-hover:scale-[1.03] group-hover:-translate-y-1">
        <CardHeader className="p-0">
          {/* Enhanced Recipe Image */}
          <div className="relative aspect-video rounded-t-2xl overflow-hidden">
            {recipe.imageUrl ? (
              <img 
                src={recipe.imageUrl} 
                alt={recipe.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                <ChefHat className="h-16 w-16 text-slate-400 dark:text-slate-500" />
              </div>
            )}
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Family Consensus Badge */}
            {familyConsensus && (
              <div className="absolute top-3 right-3">
                <Badge 
                  variant={familyConsensus === 'love' ? 'default' : 'secondary'}
                  className="text-xs shadow-lg backdrop-blur-sm"
                >
                  {familyConsensus === 'love' && <Star className="h-3 w-3 mr-1" />}
                  {familyConsensus}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Enhanced Title with Actions */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-xl text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 leading-tight flex-1">
                {recipe.title}
              </h3>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(recipe)
                    }}
                    className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <Edit className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(recipe.id)
                    }}
                    className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  </Button>
                )}
              </div>
            </div>
            {recipe.description && (
              <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 leading-relaxed">
                {recipe.description}
              </p>
            )}
          </div>

          {/* Enhanced Recipe Meta */}
          <div className="flex items-center gap-4 mb-4">
            {totalTime > 0 && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium">{totalTime}m</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium">{recipe.servings}</span>
              </div>
            )}
            {recipe.rating && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <div className="w-7 h-7 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                </div>
                <span className="text-sm font-medium">{recipe.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Enhanced Difficulty and Tags */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {recipe.difficulty && (
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium ${getDifficultyColor(recipe.difficulty)} border-0`}
                >
                  {recipe.difficulty}
                </Badge>
              )}
            </div>
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex gap-1">
                {recipe.tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {tag}
                  </Badge>
                ))}
                {recipe.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    +{recipe.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


