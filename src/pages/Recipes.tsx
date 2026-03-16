import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RecipeList } from "@/components/recipes/RecipeList";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import { CollectionsSidebar } from "@/components/recipes/CollectionsSidebar";
import { apiClient, useDeleteRecipe } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";
import { Filter, X } from "lucide-react";

const Recipes = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'public' | 'mine' | 'household' | 'collection'>('public');
  const [mobileCollectionsOpen, setMobileCollectionsOpen] = useState(false);
  const { user } = useAuthStore();
  const deleteRecipeMutation = useDeleteRecipe();

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

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;
    if (!window.confirm("Are you sure you want to delete this recipe? This action cannot be undone.")) return;
    try {
      await deleteRecipeMutation.mutateAsync(selectedRecipe.id);
      toast.success("Recipe deleted");
      handleCloseDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete recipe");
    }
  };

  const showList = !showAddForm && !selectedRecipe && !editingRecipe;

  return (
    <div className="bg-stone-50 dark:bg-[#0e0f13]">
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
            onEdit={selectedRecipe.userId === user?.id ? () => handleEditRecipe(selectedRecipe) : undefined}
            onClose={handleCloseDetail}
            onDelete={selectedRecipe.userId === user?.id ? handleDeleteRecipe : undefined}
          />
        )}

        {showList && (
          <div className="animate-fade-in">
            {/* Page Title */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                {viewMode === 'collection' && selectedCollectionName ? selectedCollectionName : viewMode === 'household' ? 'Household Recipes' : viewMode === 'public' ? 'Public Recipes' : 'My Recipes'}
              </h1>
            </div>

            <div className="flex gap-6">
            {/* Mobile Collections Drawer */}
            {mobileCollectionsOpen && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={() => setMobileCollectionsOpen(false)}
                />
                <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-[#16171c] shadow-2xl animate-slide-up p-5 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-stone-900 dark:text-white">Collections</h3>
                    <button
                      onClick={() => setMobileCollectionsOpen(false)}
                      className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                    >
                      <X className="h-5 w-5 text-stone-500" />
                    </button>
                  </div>
                  <CollectionsSidebar
                    selectedCollectionId={selectedCollectionId}
                    onSelectCollection={(id) => {
                      setSelectedCollectionId(id);
                      setMobileCollectionsOpen(false);
                    }}
                    onCollectionNameChange={setSelectedCollectionName}
                    viewMode={viewMode}
                    onViewModeChange={(mode) => {
                      setViewMode(mode);
                      setMobileCollectionsOpen(false);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Desktop Collections Sidebar */}
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
              {/* Mobile Collections Toggle */}
              <div className="lg:hidden mb-4">
                <button
                  onClick={() => setMobileCollectionsOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl shadow-sm text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Collections & Filters
                </button>
              </div>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Recipes;
