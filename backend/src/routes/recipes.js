import express from 'express';
import sql from '../services/database.js';
import { parseRecipeFromText, generateEmbedding } from '../services/vertexAI.js';
import webhookService from '../services/webhookService.js';

const router = express.Router();

// Get all recipes for user
router.get('/', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { limit = 20, offset = 0 } = req.query;

    const recipes = await sql`
      SELECT * FROM recipes 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `;

    res.json({ recipes });
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Failed to get recipes' });
  }
});

// Get single recipe
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;

    const recipes = await sql`
      SELECT * FROM recipes 
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (recipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = recipes[0];

    res.json({
      recipe: {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        tags: recipe.tags,
        image_url: recipe.image_url,
        rating: recipe.rating,
        nutrition_info: recipe.nutrition_info,
        source_url: recipe.source_url,
        is_public: recipe.is_public,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at
      }
    });
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Failed to get recipe' });
  }
});

// Create new recipe
router.post('/', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const recipeData = req.body;

    // Generate embedding for search if AI service is available
    let embedding = null;
    try {
      const searchText = `${recipeData.title} ${recipeData.ingredients.map(i => i.name).join(' ')} ${recipeData.instructions.join(' ')}`;
      embedding = await generateEmbedding(searchText);
    } catch (embeddingError) {
      console.warn('Embedding generation failed:', embeddingError);
    }

    const result = await sql`
      INSERT INTO recipes (
        user_id, title, description, ingredients, instructions, 
        prep_time, cook_time, total_time, servings, difficulty, 
        tags, image_url, rating, nutrition_info, source_url, 
        is_public, embedding_vector
      )
      VALUES (
        ${userId}, ${recipeData.title}, ${recipeData.description || null}, 
        ${JSON.stringify(recipeData.ingredients)}, ${JSON.stringify(recipeData.instructions)},
        ${recipeData.prepTime || null}, ${recipeData.cookTime || null}, 
        ${recipeData.totalTime || null}, ${recipeData.servings || 4}, 
        ${recipeData.difficulty || 'medium'}, ${JSON.stringify(recipeData.tags || [])},
        ${recipeData.imageUrl || null}, ${recipeData.rating || null}, 
        ${JSON.stringify(recipeData.nutritionInfo || null)}, ${recipeData.sourceUrl || null},
        ${recipeData.isPublic || false}, ${embedding}
      )
      RETURNING *
    `;

    const newRecipe = result[0];

    // Send webhook event
    await webhookService.recipeCreated(newRecipe, req.user);

    res.status(201).json({
      message: 'Recipe created successfully',
      recipe: {
        id: newRecipe.id,
        title: newRecipe.title,
        description: newRecipe.description,
        ingredients: newRecipe.ingredients,
        instructions: newRecipe.instructions,
        prep_time: newRecipe.prep_time,
        cook_time: newRecipe.cook_time,
        total_time: newRecipe.total_time,
        servings: newRecipe.servings,
        difficulty: newRecipe.difficulty,
        tags: newRecipe.tags,
        image_url: newRecipe.image_url,
        rating: newRecipe.rating,
        nutrition_info: newRecipe.nutrition_info,
        source_url: newRecipe.source_url,
        is_public: newRecipe.is_public,
        created_at: newRecipe.created_at,
        updated_at: newRecipe.updated_at
      }
    });
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Update recipe
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;
    const updateData = req.body;

    // Check if recipe exists and user has access
    const existingRecipes = await sql`
      SELECT * FROM recipes 
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (existingRecipes.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipeData = existingRecipes[0];

    // Generate new embedding if content changed
    let embedding = recipeData.embedding_vector;
    if (updateData.title || updateData.ingredients || updateData.instructions) {
      try {
        const searchText = `${updateData.title || recipeData.title} ${(updateData.ingredients || recipeData.ingredients).map(i => i.name).join(' ')} ${(updateData.instructions || recipeData.instructions).join(' ')}`;
        embedding = await generateEmbedding(searchText);
      } catch (embeddingError) {
        console.warn('Embedding generation failed:', embeddingError);
      }
    }

    // Update recipe
    const result = await sql`
      UPDATE recipes 
      SET 
        title = ${updateData.title || recipeData.title},
        description = ${updateData.description || recipeData.description},
        ingredients = ${JSON.stringify(updateData.ingredients || recipeData.ingredients)},
        instructions = ${JSON.stringify(updateData.instructions || recipeData.instructions)},
        prep_time = ${updateData.prepTime || recipeData.prep_time},
        cook_time = ${updateData.cookTime || recipeData.cook_time},
        total_time = ${updateData.totalTime || recipeData.total_time},
        servings = ${updateData.servings || recipeData.servings},
        difficulty = ${updateData.difficulty || recipeData.difficulty},
        tags = ${JSON.stringify(updateData.tags || recipeData.tags)},
        image_url = ${updateData.imageUrl || recipeData.image_url},
        rating = ${updateData.rating || recipeData.rating},
        nutrition_info = ${JSON.stringify(updateData.nutritionInfo || recipeData.nutrition_info)},
        source_url = ${updateData.sourceUrl || recipeData.source_url},
        is_public = ${updateData.isPublic || recipeData.is_public},
        embedding_vector = ${embedding},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    const updatedRecipe = result[0];

    // Send webhook event with changes
    const changes = {
      title: updateData.title ? 'updated' : null,
      description: updateData.description ? 'updated' : null,
      ingredients: updateData.ingredients ? 'updated' : null,
      instructions: updateData.instructions ? 'updated' : null,
      prepTime: updateData.prepTime ? 'updated' : null,
      cookTime: updateData.cookTime ? 'updated' : null,
      servings: updateData.servings ? 'updated' : null,
      difficulty: updateData.difficulty ? 'updated' : null,
      tags: updateData.tags ? 'updated' : null
    };
    await webhookService.recipeUpdated(updatedRecipe, req.user, changes);

    res.json({
      message: 'Recipe updated successfully',
      recipe: {
        id: updatedRecipe.id,
        title: updatedRecipe.title,
        description: updatedRecipe.description,
        ingredients: updatedRecipe.ingredients,
        instructions: updatedRecipe.instructions,
        prep_time: updatedRecipe.prep_time,
        cook_time: updatedRecipe.cook_time,
        total_time: updatedRecipe.total_time,
        servings: updatedRecipe.servings,
        difficulty: updatedRecipe.difficulty,
        tags: updatedRecipe.tags,
        image_url: updatedRecipe.image_url,
        rating: updatedRecipe.rating,
        nutrition_info: updatedRecipe.nutrition_info,
        source_url: updatedRecipe.source_url,
        is_public: updatedRecipe.is_public,
        created_at: updatedRecipe.created_at,
        updated_at: updatedRecipe.updated_at
      }
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

// Delete recipe
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;

    const result = await sql`
      DELETE FROM recipes 
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Send webhook event
    await webhookService.recipeDeleted(id, req.user);

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Search recipes
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { id: userId } = req.user;
    const { limit = 10 } = req.query;

    // Simple text search for now
    // TODO: Implement vector search when embeddings are ready
    const recipes = await sql`
      SELECT * FROM recipes 
      WHERE user_id = ${userId}
      AND (
        title ILIKE ${`%${query}%`} OR
        description ILIKE ${`%${query}%`} OR
        tags::text ILIKE ${`%${query}%`}
      )
      ORDER BY 
        CASE WHEN title ILIKE ${`%${query}%`} THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT ${parseInt(limit)}
    `;

    res.json({ 
      recipes: recipes.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        tags: recipe.tags,
        image_url: recipe.image_url,
        rating: recipe.rating,
        nutrition_info: recipe.nutrition_info,
        source_url: recipe.source_url,
        is_public: recipe.is_public,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at
      })),
      total: recipes.length
    });
  } catch (error) {
    console.error('Search recipes error:', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
});

export default router;
