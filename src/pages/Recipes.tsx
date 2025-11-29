import { useState } from "react";
import { RecipeList } from "@/components/recipes/RecipeList";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm } from "@/components/recipes/RecipeForm";

const Recipes = () => {
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [initialRecipeData, setInitialRecipeData] = useState<any>(null);

  const handleRecipeSelect = (recipe: any) => {
    setSelectedRecipe(recipe);
    setShowAddForm(false);
    setEditingRecipe(null);
    setInitialRecipeData(null);
  };

  const handleAddRecipe = () => {
    setShowAddForm(true);
    setSelectedRecipe(null);
    setEditingRecipe(null);
    setInitialRecipeData(null);
  };

  const handleAddRecipeWithData = (recipeData: any) => {
    setInitialRecipeData(recipeData);
    setShowAddForm(true);
    setSelectedRecipe(null);
    setEditingRecipe(null);
  };

  const handleEditRecipe = (recipe: any) => {
    setEditingRecipe(recipe);
    setShowAddForm(false);
    setSelectedRecipe(null);
    setInitialRecipeData(null);
  };

  const handleCloseForm = () => {
    setShowAddForm(false);
    setEditingRecipe(null);
  };

  const handleCloseDetail = () => {
    setSelectedRecipe(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showAddForm && (
          <div className="animate-fade-in">
            <RecipeForm
              recipe={editingRecipe || initialRecipeData}
              onSave={() => {
                handleCloseForm();
                // Refresh recipe list
              }}
              onCancel={handleCloseForm}
            />
          </div>
        )}

        {selectedRecipe && (
          <div className="animate-fade-in">
            <RecipeDetail
              recipe={selectedRecipe}
              onEdit={() => handleEditRecipe(selectedRecipe)}
              onClose={handleCloseDetail}
            />
          </div>
        )}

        {!showAddForm && !selectedRecipe && (
          <div className="animate-fade-in">
            <RecipeList
              onRecipeSelect={handleRecipeSelect}
              onAddRecipe={handleAddRecipe}
              onEditRecipe={handleEditRecipe}
              onAddRecipeWithData={handleAddRecipeWithData}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Recipes;
