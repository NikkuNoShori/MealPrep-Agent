// N8N AI Integration Service
// Handles communication with N8N workflows for AI processing via OpenRouter

export class N8nAIService {
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.openRouterBaseUrl = 'https://openrouter.ai/api/v1';
  }

  // Send message to N8N workflow for AI processing
  async processChatMessage(message, context = {}) {
    try {
      const payload = {
        message,
        context,
        timestamp: new Date().toISOString(),
        type: 'chat_message'
      };

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`N8N workflow error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.aiResponse || 'Sorry, I could not process your message at this time.';
    } catch (error) {
      console.error('Error processing chat message through N8N:', error);
      throw new Error('Failed to process message through AI workflow');
    }
  }

  // Parse recipe through N8N workflow
  async parseRecipe(recipeText, userPreferences = {}) {
    try {
      const payload = {
        recipeText,
        userPreferences,
        timestamp: new Date().toISOString(),
        type: 'recipe_parsing'
      };

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`N8N workflow error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.parsedRecipe || this.getDefaultRecipeStructure();
    } catch (error) {
      console.error('Error parsing recipe through N8N:', error);
      throw new Error('Failed to parse recipe through AI workflow');
    }
  }

  // Direct OpenRouter API call (fallback or direct integration)
  async callOpenRouter(prompt, model = 'anthropic/claude-3-sonnet', maxTokens = 1024) {
    try {
      const response = await fetch(`${this.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
          'X-Title': 'MealPrep Agent'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are MealPrep Agent, an AI assistant for family meal planning. Help users with recipes, meal planning, and cooking questions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.choices[0]?.message?.content || 'No response from AI model';
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw new Error('Failed to get AI response');
    }
  }

  // Generate recipe suggestions
  async generateRecipeSuggestions(preferences, availableIngredients = []) {
    try {
      const prompt = `
        Based on the following family preferences and available ingredients, suggest 3 recipes that would be suitable.
        
        Family Preferences:
        - Dietary restrictions: ${preferences.dietaryRestrictions?.join(', ') || 'None'}
        - Allergies: ${preferences.allergies?.join(', ') || 'None'}
        - Favorite ingredients: ${preferences.favoriteIngredients?.join(', ') || 'None'}
        - Disliked ingredients: ${preferences.dislikedIngredients?.join(', ') || 'None'}
        - Household size: ${preferences.householdSize || 4}
        
        Available ingredients: ${availableIngredients.join(', ') || 'Any ingredients available'}
        
        Return a JSON array of 3 recipe suggestions with this structure:
        [
          {
            "title": "Recipe title",
            "description": "Brief description",
            "whyRecommended": "Why this recipe is suitable",
            "difficulty": "easy|medium|hard",
            "prepTime": number,
            "cookTime": number,
            "servings": number
          }
        ]
      `;

      const response = await this.callOpenRouter(prompt);
      
      try {
        return JSON.parse(response);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        return this.getDefaultRecipeSuggestions();
      }
    } catch (error) {
      console.error('Error generating recipe suggestions:', error);
      throw new Error('Failed to generate recipe suggestions');
    }
  }

  // Get default recipe structure for fallback
  getDefaultRecipeStructure() {
    return {
      title: "Recipe",
      description: "Recipe description",
      ingredients: ["ingredient 1", "ingredient 2"],
      instructions: ["Step 1", "Step 2"],
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      difficulty: "medium",
      cuisineType: "general",
      dietaryTags: []
    };
  }

  // Get default recipe suggestions for fallback
  getDefaultRecipeSuggestions() {
    return [
      {
        title: "Simple Pasta Dish",
        description: "A quick and easy pasta recipe",
        whyRecommended: "Quick to prepare and family-friendly",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 15,
        servings: 4
      },
      {
        title: "Sheet Pan Chicken",
        description: "One-pan chicken with vegetables",
        whyRecommended: "Minimal cleanup and healthy",
        difficulty: "easy",
        prepTime: 15,
        cookTime: 25,
        servings: 4
      },
      {
        title: "Stir Fry",
        description: "Quick vegetable stir fry",
        whyRecommended: "Customizable and fast",
        difficulty: "medium",
        prepTime: 10,
        cookTime: 10,
        servings: 4
      }
    ];
  }
}

// Export singleton instance
export const n8nAI = new N8nAIService();
