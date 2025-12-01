import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Clock, Users, ChefHat, Loader2 } from "lucide-react";
import { useCreateRecipe } from "@/services/api";

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category?: string;
}

interface StructuredRecipe {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
}

interface StructuredRecipeDisplayProps {
  recipe: StructuredRecipe;
  onSave?: (recipe: StructuredRecipe) => void;
}

export const StructuredRecipeDisplay: React.FC<StructuredRecipeDisplayProps> = ({
  recipe,
  onSave,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const createRecipeMutation = useCreateRecipe();

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const handleSave = async () => {
    if (!recipe.title || !recipe.ingredients || recipe.ingredients.length === 0 || !recipe.instructions || recipe.instructions.length === 0) {
      setSaveError("Recipe is missing required fields (title, ingredients, or instructions)");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const recipeData = {
        title: recipe.title,
        description: recipe.description || "",
        prepTime: recipe.prepTime || 0,
        cookTime: recipe.cookTime || 0,
        servings: recipe.servings || 4,
        difficulty: recipe.difficulty || "medium",
        tags: recipe.tags || [],
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        imageUrl: recipe.imageUrl || "",
      };

      await createRecipeMutation.mutateAsync(recipeData);
      
      if (onSave) {
        onSave(recipe);
      }
    } catch (error: any) {
      // Error logging handled by API client
      setSaveError(error?.message || "Failed to save recipe. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <Card className="w-full max-w-2xl my-4 border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{recipe.title}</CardTitle>
            {recipe.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {recipe.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {recipe.prepTime !== undefined && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Prep: {recipe.prepTime} min
                </Badge>
              )}
              {recipe.cookTime !== undefined && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Cook: {recipe.cookTime} min
                </Badge>
              )}
              {totalTime > 0 && (
                <Badge variant="outline" className="gap-1">
                  Total: {totalTime} min
                </Badge>
              )}
              {recipe.servings !== undefined && (
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {recipe.servings} servings
                </Badge>
              )}
              {recipe.difficulty && (
                <Badge className={getDifficultyColor(recipe.difficulty)}>
                  <ChefHat className="h-3 w-3 mr-1" />
                  {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                </Badge>
              )}
            </div>
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {recipe.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="ml-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Recipe
              </>
            )}
          </Button>
        </div>
        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            {saveError}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipe Image */}
        {recipe.imageUrl && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-auto max-h-64 object-cover"
            />
          </div>
        )}

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div>
            <h4 className="font-semibold text-lg mb-3">Ingredients</h4>
            <div className="space-y-2">
              {recipe.ingredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                >
                  <span className="font-medium">{ingredient.name}</span>
                  <span className="text-muted-foreground">
                    {ingredient.amount} {ingredient.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <div>
            <h4 className="font-semibold text-lg mb-3">Instructions</h4>
            <ol className="space-y-3 list-none">
              {recipe.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <p className="flex-1 text-sm leading-relaxed">{instruction}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

