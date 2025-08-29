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
    setShowAddForm(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Recipes
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your recipe collection
        </p>
      </div>

      {showAddForm && (
        <RecipeForm
          recipe={editingRecipe}
          onSave={() => {
            handleCloseForm();
            // Refresh recipe list
          }}
          onCancel={handleCloseForm}
        />
      )}

      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          onEdit={() => handleEditRecipe(selectedRecipe)}
          onClose={handleCloseDetail}
        />
      )}

      {!showAddForm && !selectedRecipe && (
        <RecipeList
          onRecipeSelect={handleRecipeSelect}
          onAddRecipe={handleAddRecipe}
        />
      )}
    </div>
  );
};

export default Recipes;
