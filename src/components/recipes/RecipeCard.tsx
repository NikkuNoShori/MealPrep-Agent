import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Users, Star, ChefHat } from 'lucide-react'

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
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ 
  recipe, 
  viewMode, 
  onClick 
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
      <div onClick={onClick}>
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Recipe Image */}
            <div className="w-20 h-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
              {recipe.imageUrl ? (
                <img 
                  src={recipe.imageUrl} 
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ChefHat className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Recipe Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{recipe.title}</h3>
                  {recipe.description && (
                    <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
                      {recipe.description}
                    </p>
                  )}
                </div>
                {familyConsensus && (
                  <div className="flex-shrink-0">
                    <Badge 
                      variant={familyConsensus === 'love' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {familyConsensus === 'love' && <Star className="h-3 w-3 mr-1" />}
                      {familyConsensus}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Recipe Meta */}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {totalTime > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{totalTime} min</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{recipe.servings} servings</span>
                  </div>
                )}
                {recipe.difficulty && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getDifficultyColor(recipe.difficulty)}`}
                  >
                    {recipe.difficulty}
                  </Badge>
                )}
                {recipe.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{recipe.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {recipe.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {recipe.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{recipe.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
        </Card>
      </div>
    )
  }

  // Grid view
  return (
    <div onClick={onClick}>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow h-full"
      >
      <CardHeader className="p-4 pb-2">
        {/* Recipe Image */}
        <div className="aspect-video rounded-lg bg-muted overflow-hidden mb-3">
          {recipe.imageUrl ? (
            <img 
              src={recipe.imageUrl} 
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title and Family Consensus */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-2 flex-1">{recipe.title}</h3>
          {familyConsensus && (
            <Badge 
              variant={familyConsensus === 'love' ? 'default' : 'secondary'}
              className="text-xs flex-shrink-0"
            >
              {familyConsensus === 'love' && <Star className="h-3 w-3 mr-1" />}
              {familyConsensus}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Description */}
        {recipe.description && (
          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
            {recipe.description}
          </p>
        )}

        {/* Recipe Meta */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{totalTime}m</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{recipe.servings}</span>
            </div>
          )}
          {recipe.rating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{recipe.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Difficulty and Tags */}
        <div className="flex items-center justify-between">
          {recipe.difficulty && (
            <Badge 
              variant="outline" 
              className={`text-xs ${getDifficultyColor(recipe.difficulty)}`}
            >
              {recipe.difficulty}
            </Badge>
          )}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex gap-1">
              {recipe.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {recipe.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs">
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


