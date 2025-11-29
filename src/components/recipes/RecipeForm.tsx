import React, { useState, useEffect } from 'react'
import { useCreateRecipe, useUpdateRecipe } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, Save, ArrowLeft, TestTube } from 'lucide-react'

interface RecipeFormProps {
  recipe?: any
  onSave: () => void
  onCancel: () => void
}

interface Ingredient {
  name: string
  amount: number
  unit: string
  category?: string
}

export const RecipeForm: React.FC<RecipeFormProps> = ({ 
  recipe, 
  onSave, 
  onCancel 
}) => {
  // Only treat as editing if recipe has an ID (existing recipe in database)
  const isEditing = !!(recipe && recipe.id)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prepTime: '',
    cookTime: '',
    servings: '',
    difficulty: '',
    tags: [] as string[],
    ingredients: [] as Ingredient[],
    instructions: [] as string[],
    imageUrl: ''
  })

  const [newTag, setNewTag] = useState('')
  const [newIngredient, setNewIngredient] = useState({ name: '', amount: '', unit: '' })
  const [newInstruction, setNewInstruction] = useState('')

  const createRecipeMutation = useCreateRecipe()
  const updateRecipeMutation = useUpdateRecipe()

  useEffect(() => {
    if (recipe) {
      setFormData({
        title: recipe.title || '',
        description: recipe.description || '',
        prepTime: recipe.prepTime?.toString() || recipe.prep_time?.toString() || '',
        cookTime: recipe.cookTime?.toString() || recipe.cook_time?.toString() || '',
        servings: recipe.servings?.toString() || '',
        difficulty: recipe.difficulty || '',
        tags: recipe.tags || [],
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        imageUrl: recipe.imageUrl || recipe.image_url || ''
      })
    }
  }, [recipe])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const recipeData = {
      ...formData,
      prepTime: parseInt(formData.prepTime) || 0,
      cookTime: parseInt(formData.cookTime) || 0,
      servings: parseInt(formData.servings) || 0
    }

    try {
      if (isEditing && recipe?.id) {
        await updateRecipeMutation.mutateAsync({ id: recipe.id, data: recipeData })
      } else {
        await createRecipeMutation.mutateAsync(recipeData)
      }
      onSave()
    } catch (error) {
      console.error('Failed to save recipe:', error)
      // Re-throw to allow UI to handle error
      throw error
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const addIngredient = () => {
    if (newIngredient.name.trim() && newIngredient.amount && newIngredient.unit) {
      setFormData(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, {
          name: newIngredient.name.trim(),
          amount: parseFloat(newIngredient.amount),
          unit: newIngredient.unit
        }]
      }))
      setNewIngredient({ name: '', amount: '', unit: '' })
    }
  }

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  const addInstruction = () => {
    if (newInstruction.trim()) {
      setFormData(prev => ({
        ...prev,
        instructions: [...prev.instructions, newInstruction.trim()]
      }))
      setNewInstruction('')
    }
  }

  const removeInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index)
    }))
  }

  const populateTestData = () => {
    setFormData({
      title: 'Classic Spaghetti Carbonara',
      description: 'A traditional Italian pasta dish with eggs, cheese, pancetta, and black pepper. Rich, creamy, and absolutely delicious!',
      prepTime: '15',
      cookTime: '20',
      servings: '4',
      difficulty: 'medium',
      tags: ['Italian', 'Pasta', 'Quick', 'Comfort Food', 'Dinner'],
      ingredients: [
        { name: 'Spaghetti', amount: 400, unit: 'g' },
        { name: 'Pancetta', amount: 150, unit: 'g' },
        { name: 'Large eggs', amount: 4, unit: 'pieces' },
        { name: 'Parmesan cheese', amount: 100, unit: 'g' },
        { name: 'Black pepper', amount: 1, unit: 'tsp' },
        { name: 'Salt', amount: 1, unit: 'tsp' },
        { name: 'Olive oil', amount: 2, unit: 'tbsp' }
      ],
      instructions: [
        'Bring a large pot of salted water to boil and cook spaghetti according to package directions.',
        'While pasta cooks, cut pancetta into small cubes and cook in a large skillet over medium heat until crispy.',
        'In a bowl, whisk together eggs, grated Parmesan, and black pepper.',
        'Drain pasta, reserving 1 cup of pasta water.',
        'Add hot pasta to the skillet with pancetta and toss to combine.',
        'Remove from heat and quickly stir in egg mixture, adding pasta water as needed to create a creamy sauce.',
        'Serve immediately with extra Parmesan and black pepper.'
      ],
      imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop'
    })
  }

  const isLoading = createRecipeMutation.isPending || updateRecipeMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEditing ? 'Edit Recipe' : 'Add New Recipe'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update your recipe details' : 'Create a new recipe for your collection'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <Button 
              variant="outline" 
              onClick={populateTestData}
              className="gap-2 bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 hover:text-orange-800 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
            >
              <TestTube className="h-4 w-4" />
              Add Test Recipe
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save Recipe'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Recipe Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter recipe title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the recipe"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prepTime">Prep Time (min)</Label>
                  <Input
                    id="prepTime"
                    type="number"
                    value={formData.prepTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, prepTime: e.target.value }))}
                    placeholder="15"
                  />
                </div>
                <div>
                  <Label htmlFor="cookTime">Cook Time (min)</Label>
                  <Input
                    id="cookTime"
                    type="number"
                    value={formData.cookTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, cookTime: e.target.value }))}
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="servings">Servings</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={formData.servings}
                    onChange={(e) => setFormData(prev => ({ ...prev, servings: e.target.value }))}
                    placeholder="4"
                  />
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={formData.difficulty} onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" onClick={addTag} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={newIngredient.name}
                onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ingredient name"
              />
              <Input
                type="number"
                value={newIngredient.amount}
                onChange={(e) => setNewIngredient(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Amount"
              />
              <div className="flex gap-2">
                <Input
                  value={newIngredient.unit}
                  onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="Unit"
                />
                <Button type="button" onClick={addIngredient} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {formData.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="font-medium">{ingredient.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {ingredient.amount} {ingredient.unit}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeIngredient(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder="Add a cooking instruction"
                rows={2}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addInstruction())}
              />
              <Button type="button" onClick={addInstruction} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {formData.instructions.map((instruction, index) => (
                <div key={index} className="flex gap-4 p-3 bg-muted rounded">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <p className="flex-1">{instruction}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInstruction(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}


