import express from 'express';
import { db } from '../services/firebase.js';
import { generateRecipeSuggestions } from '../services/vertexAI.js';

const router = express.Router();

// Get meal plans for user
router.get('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 10 } = req.query;

    const mealPlansRef = db.collection('meal_plans')
      .where('userId', '==', uid)
      .orderBy('startDate', 'desc')
      .limit(parseInt(limit));

    const snapshot = await mealPlansRef.get();
    const mealPlans = [];

    snapshot.forEach(doc => {
      mealPlans.push({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });

    res.json({ mealPlans });
  } catch (error) {
    console.error('Get meal plans error:', error);
    res.status(500).json({ error: 'Failed to get meal plans' });
  }
});

// Create meal plan
router.post('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const { startDate, endDate, preferences } = req.body;

    // Generate recipe suggestions
    const suggestions = await generateRecipeSuggestions(preferences);

    const mealPlan = {
      userId: uid,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      preferences,
      meals: [],
      groceryList: [],
      createdAt: new Date()
    };

    const mealPlanRef = await db.collection('meal_plans').add(mealPlan);

    res.status(201).json({
      message: 'Meal plan created successfully',
      mealPlan: {
        id: mealPlanRef.id,
        ...mealPlan
      },
      suggestions
    });
  } catch (error) {
    console.error('Create meal plan error:', error);
    res.status(500).json({ error: 'Failed to create meal plan' });
  }
});

export default router;
