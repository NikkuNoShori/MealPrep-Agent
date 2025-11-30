import { useState } from "react";
import { RecipeList } from "@/components/recipes/RecipeList";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm } from "@/components/recipes/RecipeForm";

const Recipes = () => {
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);

  const handleRecipeSelect = (recipe: any) => {
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
