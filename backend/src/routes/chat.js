import express from 'express';
import { generateChatResponse, parseRecipeFromText } from '../services/vertexAI.js';
import sql from '../services/database.js';
import { io } from '../index.js';

const router = express.Router();

// Send chat message
router.post('/message', async (req, res) => {
  try {
    const { message, context } = req.body;
    const { uid } = req.user;

    // Generate AI response
    const aiResponse = await generateChatResponse(message, context);

    // Save message to Firestore
    const messageData = {
      userId: uid,
      content: message,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    const aiMessageData = {
      userId: uid,
      content: aiResponse,
      sender: 'ai',
      timestamp: new Date(),
      type: 'text'
    };

    // Save both messages
    await db.collection('chat_messages').add(messageData);
    const aiMessageRef = await db.collection('chat_messages').add(aiMessageData);

    // Emit to WebSocket if user is connected
    io.to(`user-${uid}`).emit('message-received', {
      id: aiMessageRef.id,
      content: aiResponse,
      sender: 'ai',
      timestamp: new Date()
    });

    res.json({
      message: 'Message processed successfully',
      response: {
        id: aiMessageRef.id,
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Add recipe through chat
router.post('/add-recipe', async (req, res) => {
  try {
    const { recipeText } = req.body;
    const { uid } = req.user;

    // Parse recipe using AI
    const parsedRecipe = await parseRecipeFromText(recipeText);

    // Add user-specific data
    const recipeData = {
      ...parsedRecipe,
      userId: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {}
    };

    // Save to Firestore
    const recipeRef = await db.collection('recipes').add(recipeData);

    // Generate confirmation message
    const confirmationMessage = `I've added "${parsedRecipe.title}" to your recipe collection! You can find it in your recipes section.`;

    res.json({
      message: 'Recipe added successfully',
      recipe: {
        id: recipeRef.id,
        ...recipeData
      },
      confirmation: confirmationMessage
    });
  } catch (error) {
    console.error('Add recipe error:', error);
    res.status(500).json({ error: 'Failed to add recipe' });
  }
});

// Get chat history
router.get('/history', async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 50 } = req.query;

    const messagesRef = db.collection('chat_messages')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit));

    const snapshot = await messagesRef.get();
    const messages = [];

    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      });
    });

    // Reverse to get chronological order
    messages.reverse();

    res.json({ messages });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// Clear chat history
router.delete('/history', async (req, res) => {
  try {
    const { uid } = req.user;

    const messagesRef = db.collection('chat_messages')
      .where('userId', '==', uid);

    const snapshot = await messagesRef.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
