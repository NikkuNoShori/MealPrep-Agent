import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Clock, Users, ChefHat, Loader2, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useCreateRecipe } from "@/services/api";

interface Ingredient {
  name: string;
  amount: number | null;
  unit: string;
  category?: string;
  notes?: string;
}

interface StructuredRecipe {
  title: string;
  description?: string;
  prepTime?: number | null;
  prep_time?: number | null;
  cookTime?: number | null;
  cook_time?: number | null;
  totalTime?: number | null;
  total_time?: number | null;
  servings?: number;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string | null;
  image_url?: string | null;
  cuisine?: string | null;
  nutrition_info?: Record<string, unknown> | null;
  source_url?: string | null;
  source_name?: string | null;
}

interface StructuredRecipeDisplayProps {
  recipe: StructuredRecipe;
  onSave?: (result: { success: boolean; error?: string }) => void;
}

export const StructuredRecipeDisplay: React.FC<StructuredRecipeDisplayProps> = ({
  recipe,
  onSave,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const createRecipeMutation = useCreateRecipe();

  // Normalize snake_case/camelCase fields from pipeline
  const prepTime = recipe.prepTime ?? recipe.prep_time ?? null;
  const cookTime = recipe.cookTime ?? recipe.cook_time ?? null;
  const totalTime = recipe.totalTime ?? recipe.total_time ?? (prepTime || cookTime ? (prepTime || 0) + (cookTime || 0) : null);
  const imageUrl = recipe.imageUrl ?? recipe.image_url ?? null;

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

  const formatIngredient = (ing: Ingredient): string => {
    const parts: string[] = [];
    if (ing.amount != null) parts.push(String(ing.amount));
    if (ing.unit) parts.push(ing.unit);
    return parts.join(" ") || "";
  };

  const handleSave = async () => {
    if (isSaved) return;

    if (!recipe.title || !recipe.ingredients?.length || !recipe.instructions?.length) {
      onSave?.({ success: false, error: "Recipe is missing required fields (title, ingredients, or instructions)" });
      return;
    }

    setIsSaving(true);

    try {
      const recipeData = {
        title: recipe.title,
        description: recipe.description || "",
        prepTime: prepTime || 0,
        cookTime: cookTime || 0,
        servings: recipe.servings || 4,
        difficulty: recipe.difficulty || "medium",
        tags: recipe.tags || [],
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        imageUrl: imageUrl || "",
      };

      await createRecipeMutation.mutateAsync(recipeData);
      setIsSaved(true);
      onSave?.({ success: true });
    } catch (error: any) {
      onSave?.({ success: false, error: error?.message || "Failed to save recipe. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl my-4 border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl mb-2">{recipe.title}</CardTitle>
        {recipe.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {recipe.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          {prepTime != null && prepTime > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Prep: {prepTime}m
            </Badge>
          )}
          {cookTime != null && cookTime > 0 && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Cook: {cookTime}m
            </Badge>
          )}
          {totalTime != null && totalTime > 0 && (
            <Badge variant="outline" className="gap-1">
              Total: {totalTime}m
            </Badge>
          )}
          {recipe.servings != null && (
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
        {recipe.source_url && (
          <p className="text-xs text-muted-foreground mt-2">
            Source: <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
              {recipe.source_name || recipe.source_url}
            </a>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Recipe Image */}
        {imageUrl && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt={recipe.title}
              className="w-full h-auto max-h-48 object-cover"
            />
          </div>
        )}

        {/* Ingredients — Collapsed by default */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="border border-border/40 rounded-lg">
            <button
              onClick={() => setShowIngredients(!showIngredients)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors rounded-lg"
            >
              <h4 className="font-semibold text-sm">
                Ingredients ({recipe.ingredients.length})
              </h4>
              {showIngredients ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showIngredients && (
              <div className="px-4 pb-3 space-y-1">
                {recipe.ingredients.map((ingredient, index) => {
                  const qty = formatIngredient(ingredient);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-sm"
                    >
                      <span className="font-medium">{ingredient.name}</span>
                      {qty && (
                        <span className="text-muted-foreground ml-2 text-right whitespace-nowrap">
                          {qty}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Instructions — Collapsed by default */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <div className="border border-border/40 rounded-lg">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors rounded-lg"
            >
              <h4 className="font-semibold text-sm">
                Instructions ({recipe.instructions.length} steps)
              </h4>
              {showInstructions ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showInstructions && (
              <ol className="px-4 pb-3 space-y-2 list-none">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex gap-2.5">
                    <div className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                      {index + 1}
                    </div>
                    <p className="flex-1 text-sm leading-relaxed">{instruction}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Save button at the bottom of the card */}
        <Button
          onClick={handleSave}
          disabled={isSaving || isSaved}
          size="sm"
          variant={isSaved ? "outline" : "default"}
          className="w-full mt-3"
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              Saved
            </>
          ) : isSaving ? (
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
      </CardContent>
    </Card>
  );
};
