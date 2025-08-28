import express from 'express';
import { db } from '../services/firebase.js';
import { parseRecipeFromText, generateEmbedding } from '../services/vertexAI.js';

const router = express.Router();

// Get all recipes for user
router.get('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 20, offset = 0 } = req.query;

    const recipesRef = db.collection('recipes')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const snapshot = await recipesRef.get();
    const recipes = [];

    snapshot.forEach(doc => {
      recipes.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

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
    const { uid } = req.user;

    const recipeDoc = await db.collection('recipes').doc(id).get();

    if (!recipeDoc.exists) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipeData = recipeDoc.data();
    
    if (recipeData.userId !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      recipe: {
        id: recipeDoc.id,
        ...recipeData,
        createdAt: recipeData.createdAt?.toDate(),
        updatedAt: recipeData.updatedAt?.toDate()
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
    const { uid } = req.user;
    const recipeData = req.body;

    // Generate embedding for search
    const searchText = `${recipeData.title} ${recipeData.ingredients.map(i => i.name).join(' ')} ${recipeData.instructions.join(' ')}`;
    const embedding = await generateEmbedding(searchText);

    const newRecipe = {
      ...recipeData,
      userId: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      embedding
    };

    const recipeRef = await db.collection('recipes').add(newRecipe);

    res.status(201).json({
      message: 'Recipe created successfully',
      recipe: {
        id: recipeRef.id,
        ...newRecipe
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
    const { uid } = req.user;
    const updateData = req.body;

    const recipeDoc = await db.collection('recipes').doc(id).get();

    if (!recipeDoc.exists) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipeData = recipeDoc.data();
    
    if (recipeData.userId !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate new embedding if content changed
    let embedding = recipeData.embedding;
    if (updateData.title || updateData.ingredients || updateData.instructions) {
      const searchText = `${updateData.title || recipeData.title} ${(updateData.ingredients || recipeData.ingredients).map(i => i.name).join(' ')} ${(updateData.instructions || recipeData.instructions).join(' ')}`;
      embedding = await generateEmbedding(searchText);
    }

    const updatedRecipe = {
      ...updateData,
      updatedAt: new Date(),
      embedding
    };

    await db.collection('recipes').doc(id).update(updatedRecipe);

    res.json({
      message: 'Recipe updated successfully',
      recipe: {
        id,
        ...recipeData,
        ...updatedRecipe
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
    const { uid } = req.user;

    const recipeDoc = await db.collection('recipes').doc(id).get();

    if (!recipeDoc.exists) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipeData = recipeDoc.data();
    
    if (recipeData.userId !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.collection('recipes').doc(id).delete();

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
    const { uid } = req.user;
    const { limit = 10 } = req.query;

    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(query);

    // For now, we'll do a simple text search
    // In production, you'd use Vector Search for semantic search
    const recipesRef = db.collection('recipes')
      .where('userId', '==', uid);

    const snapshot = await recipesRef.get();
    const recipes = [];

    snapshot.forEach(doc => {
      const recipeData = doc.data();
      const searchText = `${recipeData.title} ${recipeData.ingredients.map(i => i.name).join(' ')} ${recipeData.instructions.join(' ')}`.toLowerCase();
      
      if (searchText.includes(query.toLowerCase())) {
        recipes.push({
          id: doc.id,
          ...recipeData,
          createdAt: recipeData.createdAt?.toDate(),
          updatedAt: recipeData.updatedAt?.toDate()
        });
      }
    });

    // Sort by relevance (simple implementation)
    recipes.sort((a, b) => {
      const aScore = a.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      const bScore = b.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      return bScore - aScore;
    });

    res.json({ 
      recipes: recipes.slice(0, parseInt(limit)),
      total: recipes.length
    });
  } catch (error) {
    console.error('Search recipes error:', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
});

export default router;
