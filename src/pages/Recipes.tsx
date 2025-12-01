import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RecipeList } from "@/components/recipes/RecipeList";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { useRecipe } from "@/services/api";
import { recipeService } from "@/services/recipeService";

const Recipes = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);

  // Load recipe from URL slug if present
  useEffect(() => {
    if (slug) {
      // Try to load recipe by slug (or ID if slug is a UUID)
      recipeService.getRecipe(slug)
        .then(recipe => {
          if (recipe) {
            setSelectedRecipe(recipe);
          } else {
            // Recipe not found, redirect to recipes list
            navigate('/recipes');
          }
        })
        .catch(error => {
          console.error('Error loading recipe:', error);
          navigate('/recipes');
        });
    }
  }, [slug, navigate]);

  const handleRecipeSelect = (recipe: any) => {
    // Navigate to recipe URL using slug if available, otherwise use ID
    if (recipe.slug) {
      navigate(`/recipes/${recipe.slug}`);
    } else {
      // Fallback to ID if slug not available (for backwards compatibility)
      navigate(`/recipes/${recipe.id}`);
    }
    setSelectedRecipe(recipe);
    setShowAddForm(false);
    setEditingRecipe(null);
  };

  const handleAddRecipe = () => {
    setShowAddForm(true);
    setSelectedRecipe(null);
    setEditingRecipe(null);
  };

  const handleEditRecipe = (recipe: any) => {
    setEditingRecipe(recipe);
    setShowAddForm(true);
    setSelectedRecipe(null);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingRecipe(null);
  };

  const handleCloseDetail = () => {
    setSelectedRecipe(null);
    navigate('/recipes'); // Navigate back to recipes list
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/20 to-secondary-50/20 dark:from-slate-900 dark:via-gray-900 dark:to-gray-900">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(showAddForm || editingRecipe) && (
          <div className="animate-fade-in">
            <RecipeForm
              recipe={editingRecipe}
              onSave={() => {
                handleCloseForm();
                // Refresh recipe list
              }}
              onCancel={handleCloseForm}
            />
          </div>
        )}

        {selectedRecipe && !showAddForm && !editingRecipe && (
          <RecipeDetail
            recipe={selectedRecipe}
            onEdit={() => handleEditRecipe(selectedRecipe)}
            onClose={handleCloseDetail}
          />
        )}

        {!showAddForm && !selectedRecipe && !editingRecipe && (
          <div className="animate-fade-in">
            <RecipeList
              onRecipeSelect={handleRecipeSelect}
              onAddRecipe={handleAddRecipe}
              onEditRecipe={handleEditRecipe}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Recipes;
