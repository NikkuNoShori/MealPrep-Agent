import React, { useState, useImperativeHandle, forwardRef, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Clock, Users, ChefHat, Loader2, CheckCircle2, ChevronDown, ChevronRight, AlertTriangle, Copy, X, RefreshCw, Pencil, Check } from "lucide-react";
import { useCreateRecipe, useUpdateRecipe, apiClient } from "@/services/api";
import { fetchImageAsFile } from "@/utils/recipeImagePicker";
import { VisibilityPicker, type RecipeVisibility } from "@/components/recipes/VisibilityPicker";
import { useDraftRecipeStore } from "@/stores/draftRecipeStore";
import type { StructuredRecipe as StructuredRecipeType } from "@/types";

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
  sourceUrl?: string | null;
  sourceName?: string | null;
}

interface SimilarRecipeMatch {
  id: string;
  title: string;
  similarity: number;
}

type SavePhase =
  | "idle"
  | "checking_title"       // Phase 1: checking for duplicate title
  | "duplicate_found"      // Phase 1 result: duplicate title exists
  | "confirm_overwrite"    // Phase 1b: user clicked Overwrite, confirm before proceeding
  | "uploading_image"      // Uploading user image
  | "checking_similarity"  // Phase 2: checking for similar recipes via embedding
  | "similar_found"        // Phase 2 result: similar recipes found
  | "saving"               // Final save in progress
  | "saved";               // Done

export interface StructuredRecipeDisplayHandle {
  /** Programmatically trigger save (used by "Save All" button). */
  triggerSave: () => void;
  /** Whether this card has already been saved. */
  isSaved: () => boolean;
}

interface StructuredRecipeDisplayProps {
  recipe: StructuredRecipe;
  conversationId?: string;
  messageId?: string;
  recipeIndex?: number;
  draftKey?: string;
  /** Base64 data URL of user-uploaded image to save as recipe image */
  userImageDataUrl?: string;
  /** Best video keyframe selected client-side for upload on save */
  previewImageDataUrl?: string;
  /** Platform oEmbed thumbnail (fallback if keyframe upload fails) */
  thumbnailUrl?: string;
  onSave?: (result: { success: boolean; error?: string }) => void;
}

function normalizeRecipeForDraft(recipe: StructuredRecipe): StructuredRecipeType {
  return {
    title: recipe.title,
    description: recipe.description,
    prepTime: (recipe.prepTime ?? recipe.prep_time ?? undefined) as number | undefined,
    cookTime: (recipe.cookTime ?? recipe.cook_time ?? undefined) as number | undefined,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    tags: recipe.tags ?? [],
    ingredients: recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount ?? 0,
      unit: ing.unit,
      category: (ing.category ?? "other") as StructuredRecipeType["ingredients"][number]["category"],
    })),
    instructions: recipe.instructions,
    imageUrl: (recipe.imageUrl ?? recipe.image_url ?? undefined) as string | undefined,
    sourceUrl: (recipe.sourceUrl ?? recipe.source_url ?? undefined) as string | undefined,
    sourceName: (recipe.sourceName ?? recipe.source_name ?? undefined) as string | undefined,
  };
}

/**
 * Convert a base64 data URL to a File object for upload.
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

function CompactIngredientRow({
  ingredient,
  onChange,
}: {
  ingredient: Ingredient;
  onChange: (updated: Ingredient) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ingredient.name);
  const [amount, setAmount] = useState(
    ingredient.amount != null && ingredient.amount > 0 ? String(ingredient.amount) : ""
  );
  const [unit, setUnit] = useState(ingredient.unit);

  useEffect(() => {
    setName(ingredient.name);
    setAmount(
      ingredient.amount != null && ingredient.amount > 0 ? String(ingredient.amount) : ""
    );
    setUnit(ingredient.unit);
  }, [ingredient]);

  const qtyLabel = [ingredient.amount, ingredient.unit].filter(Boolean).join(" ");

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onChange({
      ...ingredient,
      name: trimmedName,
      amount: amount ? parseFloat(amount) || null : null,
      unit: unit.trim(),
    });
    setEditing(false);
  };

  const cancel = () => {
    setName(ingredient.name);
    setAmount(
      ingredient.amount != null && ingredient.amount > 0 ? String(ingredient.amount) : ""
    );
    setUnit(ingredient.unit);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 py-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoFocus
          className="h-7 flex-1 min-w-0 text-xs"
        />
        <Input
          type="number"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Qty"
          className="h-7 w-12 text-xs text-center px-1"
        />
        <Input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit"
          className="h-7 w-14 text-xs px-1"
        />
        <Button type="button" variant="ghost" size="icon" onClick={save} className="h-6 w-6 shrink-0">
          <Check className="h-3 w-3" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={cancel} className="h-6 w-6 shrink-0">
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-sm gap-2">
      <span className="font-medium flex-1 min-w-0 truncate">{ingredient.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        {qtyLabel && (
          <span className="text-muted-foreground text-xs whitespace-nowrap">{qtyLabel}</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setEditing(true)}
          className="h-6 w-6"
          aria-label={`Edit ${ingredient.name}`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function CompactInstructionRow({
  instruction,
  index,
  onChange,
}: {
  instruction: string;
  index: number;
  onChange: (updated: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(instruction);

  useEffect(() => {
    setValue(instruction);
  }, [instruction]);

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setValue(instruction);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="flex gap-2 py-1">
        <div className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 flex gap-1 min-w-0">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[52px] text-xs resize-none flex-1"
            rows={2}
          />
          <div className="flex flex-col gap-0.5">
            <Button type="button" variant="ghost" size="icon" onClick={save} className="h-6 w-6">
              <Check className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={cancel} className="h-6 w-6">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2.5 group">
      <div className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
        {index + 1}
      </div>
      <p
        className="flex-1 text-sm leading-relaxed cursor-pointer rounded px-1 -mx-1 hover:bg-muted/60"
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {instruction}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setEditing(true)}
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
        aria-label={`Edit step ${index + 1}`}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </li>
  );
}

export const StructuredRecipeDisplay = forwardRef<StructuredRecipeDisplayHandle, StructuredRecipeDisplayProps>(({
  recipe,
  conversationId,
  messageId,
  recipeIndex = 0,
  draftKey,
  userImageDataUrl,
  previewImageDataUrl,
  thumbnailUrl,
  onSave,
}, ref) => {
  const upsertDraft = useDraftRecipeStore((s) => s.upsertDraft);
  const patchDraft = useDraftRecipeStore((s) => s.patchDraft);
  const clearDraft = useDraftRecipeStore((s) => s.clearDraft);
  const draftEntry = useDraftRecipeStore((s) =>
    draftKey ? s.drafts[draftKey] : undefined
  );

  const [savePhase, setSavePhase] = useState<SavePhase>("idle");
  const [similarRecipes, setSimilarRecipes] = useState<SimilarRecipeMatch[]>([]);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState(recipe.title);
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe.ingredients ?? []);
  const [instructions, setInstructions] = useState<string[]>(recipe.instructions ?? []);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [visibility, setVisibility] = useState<RecipeVisibility>("private");
  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const draftInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draftKey || !conversationId || !messageId) {
      setSaveTitle(recipe.title);
      setIngredients(recipe.ingredients ?? []);
      setInstructions(recipe.instructions ?? []);
      return;
    }

    if (draftInitializedRef.current === draftKey) return;
    draftInitializedRef.current = draftKey;

    const existing = useDraftRecipeStore.getState().getDraft(draftKey);
    if (existing) {
      setSaveTitle(existing.recipe.title);
      setIngredients(existing.recipe.ingredients as Ingredient[]);
      setInstructions(existing.recipe.instructions);
      return;
    }

    upsertDraft(draftKey, {
      conversationId,
      messageId,
      recipeIndex,
      recipe: normalizeRecipeForDraft(recipe),
      previewImageDataUrl,
      thumbnailUrl,
    });
    setSaveTitle(recipe.title);
    setIngredients(recipe.ingredients ?? []);
    setInstructions(recipe.instructions ?? []);
  }, [
    draftKey,
    conversationId,
    messageId,
    recipeIndex,
    recipe,
    previewImageDataUrl,
    thumbnailUrl,
    upsertDraft,
  ]);

  useEffect(() => {
    if (!draftKey || draftInitializedRef.current !== draftKey) return;
    patchDraft(draftKey, {
      recipe: {
        title: saveTitle,
        ingredients: ingredients.map((ing) => ({
          name: ing.name,
          amount: ing.amount ?? 0,
          unit: ing.unit,
          category: (ing.category ?? "other") as StructuredRecipeType["ingredients"][number]["category"],
        })),
        instructions,
      },
    });
  }, [draftKey, saveTitle, ingredients, instructions, patchDraft]);

  const effectivePreviewImage =
    draftEntry?.previewImageDataUrl ?? previewImageDataUrl;
  const effectiveThumbnail = draftEntry?.thumbnailUrl ?? thumbnailUrl;

  // Normalize snake_case/camelCase fields from pipeline
  const prepTime = recipe.prepTime ?? recipe.prep_time ?? null;
  const cookTime = recipe.cookTime ?? recipe.cook_time ?? null;
  const totalTime = recipe.totalTime ?? recipe.total_time ?? (prepTime || cookTime ? (prepTime || 0) + (cookTime || 0) : null);
  const imageUrl = recipe.imageUrl ?? recipe.image_url ?? null;
  const sourceUrl = recipe.sourceUrl ?? recipe.source_url ?? null;
  const sourceName = recipe.sourceName ?? recipe.source_name ?? null;
  const displayImageUrl =
    imageUrl ||
    effectivePreviewImage ||
    effectiveThumbnail ||
    null;

  const isBusy = savePhase === "checking_title" || savePhase === "uploading_image" || savePhase === "checking_similarity" || savePhase === "saving";
  const isPrompting = savePhase === "duplicate_found" || savePhase === "confirm_overwrite" || savePhase === "similar_found";
  const isSaved = savePhase === "saved";

  const finishSave = () => {
    if (draftKey) clearDraft(draftKey);
    setSavePhase("saved");
    onSave?.({ success: true });
  };

  // Expose imperative handle for "Save All" button
  useImperativeHandle(ref, () => ({
    triggerSave: () => { if (!isSaved && !isBusy) handleSave(); },
    isSaved: () => isSaved,
  }));

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

  /** Upload best available preview image on save. */
  const uploadImage = async (): Promise<string> => {
    const slug = saveTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);

    const isHostedRecipeImage = (url: string) =>
      url.includes("/storage/v1/object/") && url.includes("recipe-images");

    if (imageUrl && isHostedRecipeImage(imageUrl)) {
      return imageUrl;
    }

    const dataUrl = effectivePreviewImage || userImageDataUrl;
    if (dataUrl) {
      try {
        setSavePhase("uploading_image");
        const imageFile = dataUrlToFile(dataUrl, `${slug}.jpg`);
        const uploaded = await apiClient.uploadImage(imageFile, "recipes");
        console.log("Uploaded recipe preview image:", uploaded);
        return uploaded;
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.warn("Preview image upload failed (non-fatal):", msg);
      }
    }

    const remoteThumb = effectiveThumbnail || (imageUrl?.startsWith("http") ? imageUrl : null);
    if (remoteThumb) {
      try {
        setSavePhase("uploading_image");
        const imageFile = await fetchImageAsFile(remoteThumb, slug);
        const uploaded = await apiClient.uploadImage(imageFile, "recipes");
        console.log("Uploaded recipe thumbnail:", uploaded);
        return uploaded;
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.warn("Thumbnail upload failed, storing external URL:", msg);
        return remoteThumb;
      }
    }

    return imageUrl || "";
  };

  /** Build the recipe data object for save. */
  const buildRecipeData = (title: string, finalImageUrl: string) => ({
    title,
    description: recipe.description || "",
    prepTime: prepTime || 0,
    cookTime: cookTime || 0,
    servings: recipe.servings || 4,
    difficulty: recipe.difficulty || "medium",
    tags: recipe.tags || [],
    ingredients,
    instructions,
    imageUrl: finalImageUrl,
    sourceUrl: sourceUrl || undefined,
    sourceName: sourceName || undefined,
    visibility,
  });

  /** Final save — skips the duplicate check in createRecipe since we already checked. */
  const doSave = async (title: string, skipSimilarityCheck = false) => {
    setSavePhase("saving");
    try {
      const finalImageUrl = await uploadImage();
      const recipeData = buildRecipeData(title, finalImageUrl);

      // Phase 2: similarity check (unless skipped)
      if (!skipSimilarityCheck) {
        setSavePhase("checking_similarity");
        try {
          const { similar } = await apiClient.checkSimilarRecipes({
            title: recipeData.title,
            description: recipeData.description,
            ingredients: recipeData.ingredients,
            instructions: recipeData.instructions,
            tags: recipeData.tags,
            cuisine: recipe.cuisine || undefined,
            difficulty: recipeData.difficulty,
          });

          if (similar && similar.length > 0) {
            setSimilarRecipes(similar);
            setSavePhase("similar_found");
            return; // Pause — user must confirm
          }
        } catch (err) {
          // Similarity check failed (non-fatal) — proceed with save
          console.warn("Similarity check failed (non-fatal):", err);
        }
      }

      // Proceed with actual save
      setSavePhase("saving");
      await createRecipeMutation.mutateAsync({ data: recipeData, options: { skipDuplicateCheck: true } });
      finishSave();
    } catch (error: any) {
      setSavePhase("idle");
      onSave?.({ success: false, error: error?.message || "Failed to save recipe. Please try again." });
    }
  };

  /** Phase 1: title duplicate check, then proceed to Phase 2 + save. */
  const handleSave = async () => {
    if (isSaved || isBusy) return;

    if (!saveTitle || !ingredients.length || !instructions.length) {
      onSave?.({ success: false, error: "Recipe is missing required fields (title, ingredients, or instructions)" });
      return;
    }

    setSavePhase("checking_title");
    try {
      const { isDuplicate, existingId } = await apiClient.checkDuplicateTitle(saveTitle);
      if (isDuplicate) {
        setDuplicateId(existingId || null);
        setSavePhase("duplicate_found");
        return; // Pause — user must choose
      }
    } catch (err) {
      // Title check failed (non-fatal) — proceed anyway
      console.warn("Title check failed (non-fatal):", err);
    }

    // No duplicate — proceed to Phase 2 (similarity) + save
    await doSave(saveTitle);
  };

  /** User chose "Overwrite" from Phase 1 duplicate prompt — ask for confirmation. */
  const handleOverwriteRequest = () => {
    setSavePhase("confirm_overwrite");
  };

  /** User confirmed overwrite — update the existing recipe. */
  const handleOverwriteConfirm = async () => {
    if (!duplicateId) return;
    setSavePhase("saving");
    try {
      const finalImageUrl = await uploadImage();
      const recipeData = buildRecipeData(saveTitle, finalImageUrl);
      await updateRecipeMutation.mutateAsync({ id: duplicateId, data: recipeData });
      finishSave();
    } catch (error: any) {
      setSavePhase("idle");
      onSave?.({ success: false, error: error?.message || "Failed to overwrite recipe." });
    }
  };

  /** User chose "Save as Copy" from Phase 1 duplicate prompt. */
  const handleSaveAsCopy = async () => {
    const copyTitle = `${recipe.title} (Copy)`;
    setSaveTitle(copyTitle);
    await doSave(copyTitle);
  };

  /** User chose "Save Anyway" from Phase 2 similarity prompt. */
  const handleSaveDespiteSimilar = async () => {
    setSimilarRecipes([]);
    await doSave(saveTitle, true); // skip similarity re-check
  };

  /** User cancelled from any prompt. */
  const handleCancel = () => {
    setSavePhase("idle");
    setSimilarRecipes([]);
    setDuplicateId(null);
  };

  const getPhaseStatusText = () => {
    switch (savePhase) {
      case "checking_title": return "Checking for duplicates...";
      case "uploading_image": return "Uploading image...";
      case "checking_similarity": return "Checking for similar recipes...";
      case "saving": return "Saving...";
      default: return "Saving...";
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
        {sourceUrl && (
          <p className="text-xs text-muted-foreground mt-2">
            Source:{" "}
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              {sourceName || sourceUrl}
            </a>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Recipe Image */}
        {displayImageUrl && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={displayImageUrl}
              alt={recipe.title}
              className="w-full h-auto max-h-48 object-cover"
            />
          </div>
        )}

        {/* Ingredients — Collapsed by default */}
        {ingredients.length > 0 && (
          <div className="border border-border/40 rounded-lg">
            <button
              onClick={() => setShowIngredients(!showIngredients)}
              className="w-full flex items-center justify-between px-4 py-2.5 transition-colors rounded-lg hover:text-stone-900 dark:hover:text-white"
            >
              <h4 className="font-semibold text-sm">
                Ingredients ({ingredients.length})
              </h4>
              {showIngredients ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showIngredients && (
              <div className="px-4 pb-3">
                {ingredients.map((ingredient, index) => (
                  <CompactIngredientRow
                    key={index}
                    ingredient={ingredient}
                    onChange={(updated) =>
                      setIngredients((prev) =>
                        prev.map((item, i) => (i === index ? updated : item))
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions — Collapsed by default */}
        {instructions.length > 0 && (
          <div className="border border-border/40 rounded-lg">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full flex items-center justify-between px-4 py-2.5 transition-colors rounded-lg hover:text-stone-900 dark:hover:text-white"
            >
              <h4 className="font-semibold text-sm">
                Instructions ({instructions.length} steps)
              </h4>
              {showInstructions ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showInstructions && (
              <ol className="px-4 pb-3 space-y-2 list-none">
                {instructions.map((instruction, index) => (
                  <CompactInstructionRow
                    key={index}
                    instruction={instruction}
                    index={index}
                    onChange={(updated) =>
                      setInstructions((prev) =>
                        prev.map((item, i) => (i === index ? updated : item))
                      )
                    }
                  />
                ))}
              </ol>
            )}
          </div>
        )}

        {/* ── Phase 1 Prompt: Duplicate title found ── */}
        {savePhase === "duplicate_found" && (
          <div className="border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Duplicate recipe name
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-0.5">
                  A recipe named "{saveTitle}" already exists in your collection.
                </p>
              </div>
            </div>
            <div className="flex gap-2 ml-6">
              <Button size="sm" variant="outline" onClick={handleSaveAsCopy} className="gap-1">
                <Copy className="h-3 w-3" />
                Save as Copy
              </Button>
              <Button size="sm" variant="destructive" onClick={handleOverwriteRequest} className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Overwrite
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="gap-1">
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Phase 1b: Confirm overwrite ── */}
        {savePhase === "confirm_overwrite" && (
          <div className="border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-800 dark:text-red-200">
                  Confirm overwrite
                </p>
                <p className="text-red-700 dark:text-red-300 mt-0.5">
                  This will replace your existing "{saveTitle}" recipe. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 ml-6">
              <Button size="sm" variant="destructive" onClick={handleOverwriteConfirm}>
                Yes, Overwrite
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="gap-1">
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Phase 2 Prompt: Similar recipes found ── */}
        {savePhase === "similar_found" && similarRecipes.length > 0 && (
          <div className="border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-primary-800 dark:text-primary-200">
                  Similar recipes detected
                </p>
                <p className="text-primary-700 dark:text-primary-300 mt-0.5">
                  We found recipes in your collection that look similar:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {similarRecipes.map((match) => (
                    <li key={match.id} className="text-primary-700 dark:text-primary-300">
                      <span className="font-medium">{match.title}</span>
                      <span className="text-primary-500 dark:text-primary-400 ml-1.5">
                        ({Math.round(match.similarity * 100)}% similar)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex gap-2 ml-6">
              <Button size="sm" variant="default" onClick={handleSaveDespiteSimilar}>
                Save Anyway
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="gap-1">
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Visibility picker + Save button at the bottom of the card */}
        {!isPrompting && !isSaved && !isBusy && (
          <div className="flex items-center justify-between mt-3 mb-1">
            <span className="text-xs text-muted-foreground mr-2">Visibility:</span>
            <VisibilityPicker value={visibility} onChange={setVisibility} size="sm" />
          </div>
        )}
        {!isPrompting && (
          <Button
            onClick={handleSave}
            disabled={isBusy || isSaved}
            size="sm"
            variant={isSaved ? "outline" : "default"}
            className="w-full mt-1"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Saved
              </>
            ) : isBusy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {getPhaseStatusText()}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Recipe
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

StructuredRecipeDisplay.displayName = "StructuredRecipeDisplay";
