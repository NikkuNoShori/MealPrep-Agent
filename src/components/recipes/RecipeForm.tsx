import React, { useState, useEffect } from 'react'
import { useCreateRecipe, useUpdateRecipe } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus,
  X,
  Save,
  ArrowLeft,
  TestTube,
  Upload,
  Image as ImageIcon,
  GripVertical,
  Edit2,
  Check,
  ArrowUpDown,
} from "lucide-react";
import { apiClient } from "@/services/api";
import { useMeasurementUnits } from "@/hooks/useMeasurementUnits";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RecipeFormProps {
  recipe?: any;
  onSave: () => void;
  onCancel: () => void;
}

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category?: string;
}

// Sortable Instruction Item Component
interface SortableInstructionItemProps {
  id: string;
  index: number;
  instruction: string;
  onRemove: () => void;
  onEdit: (newInstruction: string) => void;
}

const SortableInstructionItem: React.FC<SortableInstructionItemProps> = ({
  id,
  index,
  instruction,
  onRemove,
  onEdit,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(instruction);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim()) {
      onEdit(editValue.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(instruction);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-4 p-3 bg-muted rounded ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Drag to reorder"
        disabled={isEditing}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
        {index + 1}
      </div>
      {isEditing ? (
        <div className="flex-1 flex gap-2">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[60px] resize-none"
            rows={2}
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="h-8 w-8"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p
            className="flex-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
            onClick={() => setIsEditing(true)}
            title="Click to edit"
          >
            {instruction}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
};

export const RecipeForm: React.FC<RecipeFormProps> = ({
  recipe,
  onSave,
  onCancel,
}) => {
  // Only treat as editing if recipe has an ID (existing recipe in database)
  const isEditing = !!(recipe && recipe.id);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    prepTime: "",
    cookTime: "",
    servings: "",
    difficulty: "",
    tags: [] as string[],
    ingredients: [] as Ingredient[],
    instructions: [] as string[],
    imageUrl: "",
  });

  const [newTag, setNewTag] = useState("");
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    amount: "",
    unit: "",
  });
  const [newInstruction, setNewInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [ingredientSort, setIngredientSort] = useState<string>("none");

  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const measurementUnits = useMeasurementUnits();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for instructions
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFormData((prev) => {
        const oldIndex = prev.instructions.findIndex(
          (_, index) => `instruction-${index}` === active.id
        );
        const newIndex = prev.instructions.findIndex(
          (_, index) => `instruction-${index}` === over.id
        );

        return {
          ...prev,
          instructions: arrayMove(prev.instructions, oldIndex, newIndex),
        };
      });
    }
  };

  useEffect(() => {
    if (recipe) {
      const imageUrl = recipe.imageUrl || recipe.image_url || "";
      setFormData({
        title: recipe.title || "",
        description: recipe.description || "",
        prepTime:
          recipe.prepTime?.toString() || recipe.prep_time?.toString() || "",
        cookTime:
          recipe.cookTime?.toString() || recipe.cook_time?.toString() || "",
        servings: recipe.servings?.toString() || "",
        difficulty: recipe.difficulty || "",
        tags: recipe.tags || [],
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        imageUrl: imageUrl,
      });
      // Set preview if image URL exists
      if (imageUrl) {
        setImagePreview(imageUrl);
      }
    }
  }, [recipe]);

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError("Image size must be less than 5MB");
      return;
    }

    // Clear URL when file is selected
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
    setImageFile(file);
    setError(null);
    setIsUploadingImage(true);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Upload to Supabase storage
      const imageUrl = await apiClient.uploadImage(file, "recipes");
      setFormData((prev) => ({ ...prev, imageUrl }));
    } catch (error: any) {
      console.error("Failed to upload image:", error);
      setError(error?.message || "Failed to upload image. Please try again.");
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    // Clear file upload if URL is entered
    if (url) {
      setImageFile(null);
      // Clear file input
      const fileInput = document.getElementById(
        "imageFile"
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
      setImagePreview(url);
    } else {
      // If URL is cleared and no file, clear preview
      if (!imageFile) {
        setImagePreview(null);
      }
    }
    setFormData((prev) => ({ ...prev, imageUrl: url }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Recipe title is required");
      return;
    }

    // If there's a file but it hasn't been uploaded yet, upload it first
    if (imageFile && !isUploadingImage) {
      setIsUploadingImage(true);
      try {
        const imageUrl = await apiClient.uploadImage(imageFile, "recipes");
        setFormData((prev) => ({ ...prev, imageUrl }));
      } catch (error: any) {
        console.error("Failed to upload image:", error);
        setError(error?.message || "Failed to upload image. Please try again.");
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    const recipeData = {
      ...formData,
      prepTime: parseInt(formData.prepTime) || 0,
      cookTime: parseInt(formData.cookTime) || 0,
      servings: parseInt(formData.servings) || 0,
    };

    try {
      if (isEditing && recipe?.id) {
        await updateRecipeMutation.mutateAsync({
          id: recipe.id,
          data: recipeData,
        });
      } else {
        await createRecipeMutation.mutateAsync(recipeData);
      }
      onSave();
    } catch (error: any) {
      console.error("Failed to save recipe:", error);
      const errorMessage =
        error?.message || "Failed to save recipe. Please try again.";
      setError(errorMessage);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const addIngredient = () => {
    if (
      newIngredient.name.trim() &&
      newIngredient.amount &&
      newIngredient.unit
    ) {
      setFormData((prev) => ({
        ...prev,
        ingredients: [
          ...prev.ingredients,
          {
            name: newIngredient.name.trim(),
            amount: parseFloat(newIngredient.amount),
            unit: newIngredient.unit,
          },
        ],
      }));
      setNewIngredient({ name: "", amount: "", unit: "" });
    }
  };

  const removeIngredient = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const addInstruction = () => {
    if (newInstruction.trim()) {
      setFormData((prev) => ({
        ...prev,
        instructions: [...prev.instructions, newInstruction.trim()],
      }));
      setNewInstruction("");
    }
  };

  const removeInstruction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const editInstruction = (index: number, newInstruction: string) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) =>
        i === index ? newInstruction : inst
      ),
    }));
  };

  // Get sorted ingredients based on selected sort option
  const getSortedIngredients = (): Ingredient[] => {
    const ingredients = [...formData.ingredients];

    switch (ingredientSort) {
      case "name-asc":
        return ingredients.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return ingredients.sort((a, b) => b.name.localeCompare(a.name));
      case "amount-asc":
        return ingredients.sort((a, b) => a.amount - b.amount);
      case "amount-desc":
        return ingredients.sort((a, b) => b.amount - a.amount);
      default:
        return ingredients;
    }
  };

  const populateTestData = () => {
    setFormData({
      title: "Classic Spaghetti Carbonara",
      description:
        "A traditional Italian pasta dish with eggs, cheese, pancetta, and black pepper. Rich, creamy, and absolutely delicious!",
      prepTime: "15",
      cookTime: "20",
      servings: "4",
      difficulty: "medium",
      tags: ["Italian", "Pasta", "Quick", "Comfort Food", "Dinner"],
      ingredients: [
        { name: "Spaghetti", amount: 400, unit: "g" },
        { name: "Pancetta", amount: 150, unit: "g" },
        { name: "Large eggs", amount: 4, unit: "pieces" },
        { name: "Parmesan cheese", amount: 100, unit: "g" },
        { name: "Black pepper", amount: 1, unit: "tsp" },
        { name: "Salt", amount: 1, unit: "tsp" },
        { name: "Olive oil", amount: 2, unit: "tbsp" },
      ],
      instructions: [
        "Bring a large pot of salted water to boil and cook spaghetti according to package directions.",
        "While pasta cooks, cut pancetta into small cubes and cook in a large skillet over medium heat until crispy.",
        "In a bowl, whisk together eggs, grated Parmesan, and black pepper.",
        "Drain pasta, reserving 1 cup of pasta water.",
        "Add hot pasta to the skillet with pancetta and toss to combine.",
        "Remove from heat and quickly stir in egg mixture, adding pasta water as needed to create a creamy sauce.",
        "Serve immediately with extra Parmesan and black pepper.",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop",
    });
  };

  const isLoading =
    createRecipeMutation.isPending || updateRecipeMutation.isPending;

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
              {isEditing ? "Edit Recipe" : "Add New Recipe"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing
                ? "Update your recipe details"
                : "Create a new recipe for your collection"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <Button
              variant="outline"
              onClick={populateTestData}
              className="gap-2 bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 hover:text-orange-800 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
              title="Fill this form with sample recipe data (Spaghetti Carbonara) - different from the test recipe button"
            >
              <TestTube className="h-4 w-4" />
              Fill Sample Data
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isUploadingImage}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading || isUploadingImage ? "Saving..." : "Save Recipe"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Basic Information */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Recipe Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, title: e.target.value }));
                    setError(null); // Clear error when user starts typing
                  }}
                  placeholder="Enter recipe title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        prepTime: e.target.value,
                      }))
                    }
                    placeholder="15"
                  />
                </div>
                <div>
                  <Label htmlFor="cookTime">Cook Time (min)</Label>
                  <Input
                    id="cookTime"
                    type="number"
                    value={formData.cookTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        cookTime: e.target.value,
                      }))
                    }
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
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        servings: e.target.value,
                      }))
                    }
                    placeholder="4"
                  />
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, difficulty: value }))
                    }
                  >
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
                <Label htmlFor="imageUrl">Recipe Image</Label>
                <div className="space-y-3">
                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="relative w-full rounded-lg overflow-hidden border border-input bg-muted/50">
                      <div
                        className="relative w-full"
                        style={{
                          aspectRatio: "16/9",
                          minHeight: "200px",
                          maxHeight: "400px",
                        }}
                      >
                        <img
                          src={imagePreview}
                          alt="Recipe preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            console.error(
                              "Image failed to load:",
                              imagePreview
                            );
                            setError(
                              "Failed to load image. Please check the URL or try uploading a file."
                            );
                            setImagePreview(null);
                          }}
                          loading="lazy"
                        />
                        {imageFile && isUploadingImage && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Uploading...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Upload and URL Input - Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* File Upload */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          id="imageFile"
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          disabled={isUploadingImage || !!formData.imageUrl}
                          className="cursor-pointer"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          document.getElementById("imageFile")?.click()
                        }
                        disabled={isUploadingImage || !!formData.imageUrl}
                        title="Upload image"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* URL Input */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="imageUrl"
                        value={formData.imageUrl}
                        onChange={handleImageUrlChange}
                        placeholder="Or enter image URL"
                        className="pl-10"
                        disabled={isUploadingImage || !!imageFile}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload an image file or enter an image URL
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ingredients</CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={addIngredient} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
                <Select
                  value={ingredientSort}
                  onValueChange={setIngredientSort}
                >
                  <SelectTrigger className="w-8 h-8 p-0 justify-center [&>svg:last-child]:hidden">
                    <ArrowUpDown className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sorting</SelectItem>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="amount-asc">
                      Quantity (Low to High)
                    </SelectItem>
                    <SelectItem value="amount-desc">
                      Quantity (High to Low)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={newIngredient.name}
                  onChange={(e) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Ingredient name"
                />
                <Input
                  type="number"
                  value={newIngredient.amount}
                  onChange={(e) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="Amount"
                />
                <Select
                  value={newIngredient.unit}
                  onValueChange={(value) =>
                    setNewIngredient((prev) => ({
                      ...prev,
                      unit: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Weight units */}
                    {measurementUnits.weight.length > 0 && (
                      <>
                        {measurementUnits.weight.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {/* Volume units */}
                    {measurementUnits.volume.length > 0 && (
                      <>
                        {measurementUnits.volume.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {/* Countable units */}
                    {measurementUnits.countable.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {getSortedIngredients().map((ingredient: Ingredient) => {
                  // Find the original index for removal
                  const actualIndex = formData.ingredients.findIndex(
                    (ing) =>
                      ing.name === ingredient.name &&
                      ing.amount === ingredient.amount &&
                      ing.unit === ingredient.unit
                  );
                  return (
                    <div
                      key={`${actualIndex}-${ingredient.name}`}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="font-medium">{ingredient.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {ingredient.amount} {ingredient.unit}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIngredient(actualIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Instructions */}
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Instructions</CardTitle>
              <Button type="button" onClick={addInstruction} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder="Add a cooking instruction"
                rows={2}
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), addInstruction())
                }
              />

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={formData.instructions.map(
                    (_, index) => `instruction-${index}`
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {formData.instructions.map((instruction, index) => (
                      <SortableInstructionItem
                        key={`instruction-${index}`}
                        id={`instruction-${index}`}
                        index={index}
                        instruction={instruction}
                        onRemove={() => removeInstruction(index)}
                        onEdit={(newInstruction) =>
                          editInstruction(index, newInstruction)
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="lg:col-span-2 self-start">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tags</CardTitle>
              <Button type="button" onClick={addTag} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyPress={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addTag())
                }
                className="h-8 text-sm"
              />

              {formData.tags.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[...formData.tags].sort().map((tag, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Badge
                        variant="secondary"
                        className="text-xs flex-1 truncate"
                      >
                        {tag}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground hover:text-foreground p-1 rounded -ml-1 flex-shrink-0"
                        aria-label={`Remove ${tag} tag`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
};


