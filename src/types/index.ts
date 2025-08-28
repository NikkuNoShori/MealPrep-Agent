// Recipe types
export interface Recipe {
  id: string
  title: string
  ingredients: Ingredient[]
  instructions: string[]
  servings: number
  prepTime: number
  cookTime: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  preferences: { [memberId: string]: PreferenceLevel }
  nutritionInfo?: NutritionData
  createdAt: Date
  updatedAt: Date
}

export interface Ingredient {
  name: string
  amount: number
  unit: string
  category: IngredientCategory
  alternatives?: string[]
}

export type IngredientCategory = 
  | 'dairy'
  | 'meat'
  | 'produce'
  | 'pantry'
  | 'spices'
  | 'beverages'
  | 'frozen'
  | 'other'

export type PreferenceLevel = 'love' | 'like' | 'neutral' | 'dislike' | 'allergy'

export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
}

// Family types
export interface FamilyMember {
  id: string
  name: string
  dietaryRestrictions: string[]
  allergies: string[]
  preferenceProfile: PreferenceProfile
}

export interface PreferenceProfile {
  favoriteIngredients: string[]
  dislikedIngredients: string[]
  dietaryRestrictions: string[]
  allergies: string[]
  cuisinePreferences: string[]
}

// Chat types
export interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  type: 'text' | 'recipe' | 'suggestion'
}

export interface ChatContext {
  currentRecipe?: Recipe
  familyPreferences?: FamilyPreferences
  mealPlanContext?: MealPlanContext
}

export interface FamilyPreferences {
  globalRestrictions: string[]
  memberPreferences: { [memberId: string]: PreferenceProfile }
  householdSize: number
}

export interface MealPlanContext {
  startDate: Date
  endDate: Date
  targetMeals: number
  preferences: FamilyPreferences
}

// Meal Planning types
export interface MealPlan {
  id: string
  familyId: string
  startDate: Date
  meals: PlannedMeal[]
  groceryList: GroceryItem[]
}

export interface PlannedMeal {
  id: string
  date: Date
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe: Recipe
  servings: number
  notes?: string
}

export interface GroceryItem {
  name: string
  amount: number
  unit: string
  category: IngredientCategory
  checked: boolean
  estimatedPrice?: number
}

// Receipt types
export interface Receipt {
  id: string
  familyId: string
  storeInfo: StoreInfo
  rawOCRText: string
  processedItems: ProcessedReceiptItem[]
  totalAmount: number
  date: Date
  processingStatus: 'pending' | 'processed' | 'needs_review'
  userCorrections: UserCorrection[]
}

export interface StoreInfo {
  name: string
  location?: string
  receiptFormat: string
}

export interface ProcessedReceiptItem {
  originalText: string
  recognizedName: string
  category: IngredientCategory
  quantity: number
  unit: string
  price: number
  confidence: 'high' | 'medium' | 'low'
}

export interface UserCorrection {
  itemId: string
  correctedName: string
  correctedCategory: IngredientCategory
  timestamp: Date
}
