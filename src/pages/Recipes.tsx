import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RecipeList } from "@/components/recipes/RecipeList";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { CollectionsSidebar } from "@/components/recipes/CollectionsSidebar";
import { apiClient } from "@/services/api";

const Recipes = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'public' | 'mine' | 'collection'>('public');

  // Load recipe from URL slug if present
  useEffect(() => {
    if (slug) {
      apiClient.getRecipe(slug)
        .then(recipe => {
          if (recipe) {
            setSelectedRecipe(recipe);
            setShowAddForm(false);
            setEditingRecipe(null);
          } else {
            navigate('/recipes', { replace: true });
          }
        })
        .catch(() => {
          navigate('/recipes', { replace: true });
        });
    } else {
      setSelectedRecipe(null);
      setShowAddForm(false);
      setEditingRecipe(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleRecipeSelect = (recipe: any) => {
    if (recipe.slug) {
      navigate(`/recipes/${recipe.slug}`);
    } else {
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
    navigate('/recipes');
  };

  const showList = !showAddForm && !selectedRecipe && !editingRecipe;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-primary-50/20 to-secondary-50/20 dark:from-slate-900 dark:via-gray-900 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(showAddForm || editingRecipe) && (
          <div className="animate-fade-in">
            <RecipeForm
              recipe={editingRecipe}
              onSave={() => {
                handleCloseForm();
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

        {showList && (
          <div className="flex gap-6 animate-fade-in">
            {/* Collections Sidebar */}
            <div className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-4 rounded-2xl border border-border/60 bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm p-4">
                <CollectionsSidebar
                  selectedCollectionId={selectedCollectionId}
                  onSelectCollection={setSelectedCollectionId}
                  onCollectionNameChange={setSelectedCollectionName}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>
            </div>

            {/* Recipe List */}
            <div className="flex-1 min-w-0">
              <RecipeList
                onRecipeSelect={handleRecipeSelect}
                onAddRecipe={handleAddRecipe}
                onEditRecipe={handleEditRecipe}
                collectionId={selectedCollectionId}
                collectionName={selectedCollectionName}
                feedMode={viewMode}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Recipes;
