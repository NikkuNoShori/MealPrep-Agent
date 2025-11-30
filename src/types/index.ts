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

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    email: string
    displayName: string
    uid: string
  }
}

export interface ChatHistoryResponse {
  messages: ChatMessage[]
  total: number
}

export interface ChatMessageResponse {
  response: {
    id: string
    content: string
    timestamp: string
  }
}

export interface RecipesResponse {
  recipes: Recipe[]
  total: number
}
