import { VertexAI } from '@google-cloud/vertex-ai';

let vertexAI;

export const initializeVertexAI = async () => {
  try {
    vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
    });

    console.log('✅ Vertex AI initialized');
    return vertexAI;
  } catch (error) {
    console.error('❌ Vertex AI initialization failed:', error);
    throw error;
  }
};

// Recipe parsing with LLM
export const parseRecipeFromText = async (text) => {
  try {
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-pro',
      generation_config: {
        max_output_tokens: 2048,
        temperature: 0.1,
        top_p: 0.8,
        top_k: 40
      }
    });

    const prompt = `
      Parse the following recipe text and extract structured data. Return a JSON object with the following structure:
      {
        "title": "Recipe title",
        "ingredients": [
          {
            "name": "ingredient name",
            "amount": number,
            "unit": "unit of measurement",
            "category": "dairy|meat|produce|pantry|spices|beverages|frozen|other"
          }
        ],
        "instructions": ["step 1", "step 2", ...],
        "servings": number,
        "prepTime": number (in minutes),
        "cookTime": number (in minutes),
        "difficulty": "easy|medium|hard",
        "tags": ["tag1", "tag2", ...]
      }

      Recipe text:
      ${text}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const parsedRecipe = JSON.parse(response.text());

    return parsedRecipe;
  } catch (error) {
    console.error('Error parsing recipe:', error);
    throw new Error('Failed to parse recipe');
  }
};

// Generate recipe suggestions
export const generateRecipeSuggestions = async (preferences, availableIngredients = []) => {
  try {
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-pro',
      generation_config: {
        max_output_tokens: 2048,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40
      }
    });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const suggestions = JSON.parse(response.text());

    return suggestions;
  } catch (error) {
    console.error('Error generating recipe suggestions:', error);
    throw new Error('Failed to generate recipe suggestions');
  }
};

// Chat response generation
export const generateChatResponse = async (message, context) => {
  try {
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-pro',
      generation_config: {
        max_output_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40
      }
    });

    const systemPrompt = `
      You are MealPrep Agent, an AI assistant for family meal planning. You help users:
      - Add and manage recipes
      - Plan meals based on family preferences
      - Generate shopping lists
      - Answer cooking questions
      
      Be helpful, friendly, and concise. If the user wants to add a recipe, ask for the recipe details or help them parse it.
    `;

    const prompt = `
      ${systemPrompt}
      
      Context: ${JSON.stringify(context)}
      
      User message: ${message}
      
      Respond naturally as MealPrep Agent:
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error('Failed to generate chat response');
  }
};

// Generate embeddings for vector search
export const generateEmbedding = async (text) => {
  try {
    const model = vertexAI.preview.getGenerativeModel({
      model: 'textembedding-gecko@001'
    });

    const result = await model.embedContent(text);
    const embedding = result.embedding.values;

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
};

export { vertexAI };
