// RAG API endpoints for recipe search and retrieval
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Check both VITE_ prefixed and non-prefixed environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Supabase credentials not configured. RAG features may not work.');
  console.warn('⚠️  Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY) environment variables');
}

// Create client with fallback empty strings to prevent errors
const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: {
    persistSession: false
  }
});

// OpenAI API for embeddings
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Generate embeddings using OpenAI
async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Search recipes using semantic similarity
export async function searchRecipes(req, res) {
  try {
    const { query, userId, limit = 5, searchType = 'hybrid' } = req.body;

    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId are required' });
    }

    let results = [];

    if (searchType === 'semantic' || searchType === 'hybrid') {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);
      
      // Search using vector similarity
      const { data: semanticResults, error: semanticError } = await supabase.rpc(
        'search_recipes_semantic',
        {
          query_embedding: queryEmbedding,
          user_id: userId,
          match_threshold: 0.7,
          match_count: limit
        }
      );

      if (semanticError) {
        console.error('Semantic search error:', semanticError);
      } else {
        results = semanticResults || [];
      }
    }

    if (searchType === 'text' || (searchType === 'hybrid' && results.length < limit)) {
      // Fallback to full-text search
      const { data: textResults, error: textError } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId)
        .textSearch('searchable_text', query)
        .limit(limit - results.length);

      if (textError) {
        console.error('Text search error:', textError);
      } else {
        // Add similarity score for text results
        const textResultsWithScore = (textResults || []).map(recipe => ({
          ...recipe,
          similarity_score: 0.5 // Default score for text search
        }));
        results = [...results, ...textResultsWithScore];
      }
    }

    // Remove duplicates and sort by similarity score
    const uniqueResults = results.reduce((acc, current) => {
      const existing = acc.find(item => item.id === current.id);
      if (!existing) {
        acc.push(current);
      }
      return acc;
    }, []);

    uniqueResults.sort((a, b) => b.similarity_score - a.similarity_score);

    // Log search for analytics
    await supabase
      .from('recipe_search_history')
      .insert({
        user_id: userId,
        query: query,
        results_count: uniqueResults.length,
        search_type: searchType
      });

    res.json({
      results: uniqueResults.slice(0, limit),
      total: uniqueResults.length,
      searchType,
      query
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Generate embedding for a recipe
export async function generateRecipeEmbedding(req, res) {
  try {
    const { recipeId, text } = req.body;

    if (!recipeId || !text) {
      return res.status(400).json({ error: 'RecipeId and text are required' });
    }

    const embedding = await generateEmbedding(text);

    // Update the recipe with the embedding
    const { error } = await supabase
      .from('recipes')
      .update({ embedding_vector: embedding })
      .eq('id', recipeId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      embedding: embedding
    });

  } catch (error) {
    console.error('Embedding generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

// Get similar recipes
export async function getSimilarRecipes(req, res) {
  try {
    const { recipeId } = req.params;
    const { userId, limit = 5 } = req.query;

    if (!recipeId || !userId) {
      return res.status(400).json({ error: 'RecipeId and userId are required' });
    }

    // Get the target recipe's embedding
    const { data: targetRecipe, error: targetError } = await supabase
      .from('recipes')
      .select('embedding_vector')
      .eq('id', recipeId)
      .eq('user_id', userId)
      .single();

    if (targetError || !targetRecipe?.embedding_vector) {
      return res.status(404).json({ error: 'Recipe not found or no embedding available' });
    }

    // Find similar recipes
    const { data: similarRecipes, error: similarError } = await supabase.rpc(
      'search_recipes_semantic',
      {
        query_embedding: targetRecipe.embedding_vector,
        user_id: userId,
        match_threshold: 0.6,
        match_count: parseInt(limit) + 1 // +1 to exclude the original recipe
      }
    );

    if (similarError) {
      throw similarError;
    }

    // Filter out the original recipe
    const filteredResults = (similarRecipes || []).filter(recipe => recipe.id !== recipeId);

    res.json(filteredResults.slice(0, limit));

  } catch (error) {
    console.error('Similar recipes error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Search by ingredients
export async function searchByIngredients(req, res) {
  try {
    const { ingredients, userId, limit = 10 } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || !userId) {
      return res.status(400).json({ error: 'Ingredients array and userId are required' });
    }

    // Create a search query from ingredients
    const query = ingredients.join(' ');
    const queryEmbedding = await generateEmbedding(query);

    // Search for recipes containing these ingredients
    const { data: results, error } = await supabase.rpc(
      'search_recipes_semantic',
      {
        query_embedding: queryEmbedding,
        user_id: userId,
        match_threshold: 0.5,
        match_count: limit
      }
    );

    if (error) {
      throw error;
    }

    // Also do a text search for exact ingredient matches
    const ingredientQuery = ingredients.map(ing => `"${ing}"`).join(' | ');
    const { data: textResults, error: textError } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .textSearch('searchable_text', ingredientQuery)
      .limit(limit);

    // Combine and deduplicate results
    const allResults = [...(results || []), ...(textResults || [])];
    const uniqueResults = allResults.reduce((acc, current) => {
      const existing = acc.find(item => item.id === current.id);
      if (!existing) {
        acc.push({
          ...current,
          similarity_score: current.similarity_score || 0.5
        });
      }
      return acc;
    }, []);

    uniqueResults.sort((a, b) => b.similarity_score - a.similarity_score);

    res.json(uniqueResults.slice(0, limit));

  } catch (error) {
    console.error('Ingredient search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Get recipe recommendations
export async function getRecommendations(req, res) {
  try {
    const { userId, preferences = {}, limit = 10 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    let query = supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply preference filters
    if (preferences.difficulty) {
      query = query.eq('difficulty', preferences.difficulty);
    }

    if (preferences.cuisine) {
      query = query.eq('cuisine', preferences.cuisine);
    }

    if (preferences.dietary_tags && preferences.dietary_tags.length > 0) {
      query = query.overlaps('dietary_tags', preferences.dietary_tags);
    }

    if (preferences.max_prep_time) {
      // This would need a more sophisticated time parsing
      // For now, we'll skip this filter
    }

    const { data: results, error } = await query.limit(limit);

    if (error) {
      throw error;
    }

    // Add similarity scores for recommendations
    const resultsWithScore = (results || []).map(recipe => ({
      ...recipe,
      similarity_score: 0.8 // High score for recommendations
    }));

    res.json(resultsWithScore);

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Batch generate embeddings for existing recipes
export async function batchGenerateEmbeddings(req, res) {
  try {
    const { userId, batchSize = 10 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Get recipes without embeddings
    const { data: recipes, error: fetchError } = await supabase
      .from('recipes')
      .select('id, searchable_text')
      .eq('user_id', userId)
      .is('embedding_vector', null)
      .limit(batchSize);

    if (fetchError) {
      throw fetchError;
    }

    if (!recipes || recipes.length === 0) {
      return res.json({ message: 'No recipes need embedding generation', processed: 0 });
    }

    let processed = 0;
    const errors = [];

    for (const recipe of recipes) {
      try {
        const embedding = await generateEmbedding(recipe.searchable_text);
        
        const { error: updateError } = await supabase
          .from('recipes')
          .update({ embedding_vector: embedding })
          .eq('id', recipe.id);

        if (updateError) {
          errors.push({ recipeId: recipe.id, error: updateError.message });
        } else {
          processed++;
        }
      } catch (error) {
        errors.push({ recipeId: recipe.id, error: error.message });
      }
    }

    res.json({
      message: `Processed ${processed} recipes`,
      processed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Batch embedding error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
