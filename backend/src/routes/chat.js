import express from 'express';
import { generateChatResponse, parseRecipeFromText } from '../services/vertexAI.js';
import sql from '../services/database.js';
import { io } from '../index.js';
import webhookService from '../services/webhookService.js';

const router = express.Router();

// Send chat message
router.post('/message', async (req, res) => {
  try {
    const { message, context } = req.body;
    const { id: userId } = req.user;

    // Generate AI response
    const aiResponse = await generateChatResponse(message, context);

    // Save user message
    const userMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, type, timestamp)
      VALUES (${userId}, ${message}, 'user', 'text', NOW())
      RETURNING id
    `;

    // Save AI response
    const aiMessageResult = await sql`
      INSERT INTO chat_messages (user_id, content, sender, type, timestamp)
      VALUES (${userId}, ${aiResponse}, 'ai', 'text', NOW())
      RETURNING id
    `;

    const aiMessageId = aiMessageResult[0].id;

    // Send webhook event for chat message
    await webhookService.chatMessageSent({
      id: aiMessageId,
      content: message,
      type: 'text'
    }, req.user);

    // Emit to WebSocket if user is connected
    io.to(`user-${userId}`).emit('message-received', {
      id: aiMessageId,
      content: aiResponse,
      sender: 'ai',
      timestamp: new Date()
    });

    res.json({
      message: 'Message processed successfully',
      response: {
        id: aiMessageId,
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
    const { id: userId } = req.user;

    // Parse recipe using AI
    const parsedRecipe = await parseRecipeFromText(recipeText);

    // Save to database
    const result = await sql`
      INSERT INTO recipes (
        user_id, title, description, ingredients, instructions, 
        prep_time, cook_time, total_time, servings, difficulty, 
        tags, image_url, rating, nutrition_info, source_url, 
        is_public
      )
      VALUES (
        ${userId}, ${parsedRecipe.title}, ${parsedRecipe.description || null}, 
        ${JSON.stringify(parsedRecipe.ingredients)}, ${JSON.stringify(parsedRecipe.instructions)},
        ${parsedRecipe.prepTime || null}, ${parsedRecipe.cookTime || null}, 
        ${parsedRecipe.totalTime || null}, ${parsedRecipe.servings || 4}, 
        ${parsedRecipe.difficulty || 'medium'}, ${JSON.stringify(parsedRecipe.tags || [])},
        ${parsedRecipe.imageUrl || null}, ${parsedRecipe.rating || null}, 
        ${JSON.stringify(parsedRecipe.nutritionInfo || null)}, ${parsedRecipe.sourceUrl || null},
        ${false}
      )
      RETURNING id
    `;

    const recipeId = result[0].id;

    // Send webhook event for recipe added via chat
    await webhookService.recipeAddedViaChat({
      id: recipeId,
      title: parsedRecipe.title
    }, req.user);

    // Generate confirmation message
    const confirmationMessage = `I've added "${parsedRecipe.title}" to your recipe collection! You can find it in your recipes section.`;

    res.json({
      message: 'Recipe added successfully',
      recipe: {
        id: recipeId,
        ...parsedRecipe
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
    const { id: userId } = req.user;
    const { limit = 50 } = req.query;

    const messages = await sql`
      SELECT * FROM chat_messages 
      WHERE user_id = ${userId}
      ORDER BY timestamp DESC
      LIMIT ${parseInt(limit)}
    `;

    // Reverse to get chronological order
    const reversedMessages = messages.reverse().map(msg => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender,
      type: msg.type,
      timestamp: msg.timestamp
    }));

    res.json({ messages: reversedMessages });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// Clear chat history
router.delete('/history', async (req, res) => {
  try {
    const { id: userId } = req.user;

    await sql`
      DELETE FROM chat_messages 
      WHERE user_id = ${userId}
    `;

    res.json({ message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

export default router;
