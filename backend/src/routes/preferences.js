import express from 'express';
import sql from '../services/database.js';

const router = express.Router();

// Get user preferences
router.get('/', async (req, res) => {
  try {
    const { uid } = req.user;

    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    res.json({
      preferences: {
        dietaryRestrictions: userData.dietaryRestrictions || [],
        allergies: userData.allergies || [],
        favoriteIngredients: userData.favoriteIngredients || [],
        dislikedIngredients: userData.dislikedIngredients || [],
        householdSize: userData.householdSize || 1,
        cuisinePreferences: userData.cuisinePreferences || []
      }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update user preferences
router.put('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const preferences = req.body;

    const updateData = {
      dietaryRestrictions: preferences.dietaryRestrictions || [],
      allergies: preferences.allergies || [],
      favoriteIngredients: preferences.favoriteIngredients || [],
      dislikedIngredients: preferences.dislikedIngredients || [],
      householdSize: preferences.householdSize || 1,
      cuisinePreferences: preferences.cuisinePreferences || [],
      updatedAt: new Date()
    };

    await db.collection('users').doc(uid).update(updateData);

    res.json({
      message: 'Preferences updated successfully',
      preferences: updateData
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
