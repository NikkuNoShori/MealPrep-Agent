import fetch from 'node-fetch';

class WebhookService {
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    this.enabled = process.env.WEBHOOK_ENABLED === 'true';
  }

  /**
   * Send an event to n8n webhook
   * @param {string} eventType - Type of event (e.g., 'recipe.created', 'meal_plan.updated')
   * @param {Object} data - Event data payload
   * @param {Object} user - User information
   * @param {Object} metadata - Additional metadata
   */
  async sendEvent(eventType, data, user = null, metadata = {}) {
    if (!this.enabled || !this.n8nWebhookUrl) {
      console.log(`Webhook disabled or URL not configured. Event: ${eventType}`);
      return;
    }

    try {
      const payload = {
        eventType,
        timestamp: new Date().toISOString(),
        data,
        user: user ? {
          id: user.id,
          email: user.email,
          displayName: user.displayName
        } : null,
        metadata: {
          source: 'meal-prep-api',
          version: process.env.npm_package_version || '1.0.0',
          ...metadata
        }
      };

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MealPrep-API/1.0',
          'X-Event-Type': eventType,
          'X-Source': 'meal-prep-api'
        },
        body: JSON.stringify(payload),
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Webhook event sent successfully: ${eventType}`);
      return await response.json();
    } catch (error) {
      console.error(`❌ Webhook event failed: ${eventType}`, error.message);
      // Don't throw error to avoid breaking the main flow
      return null;
    }
  }

  /**
   * Recipe events
   */
  async recipeCreated(recipe, user) {
    return this.sendEvent('recipe.created', {
      recipeId: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      tags: recipe.tags
    }, user);
  }

  async recipeUpdated(recipe, user, changes) {
    return this.sendEvent('recipe.updated', {
      recipeId: recipe.id,
      title: recipe.title,
      changes,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      tags: recipe.tags
    }, user);
  }

  async recipeDeleted(recipeId, user) {
    return this.sendEvent('recipe.deleted', {
      recipeId
    }, user);
  }

  /**
   * Chat events
   */
  async chatMessageSent(message, user) {
    return this.sendEvent('chat.message_sent', {
      messageId: message.id,
      content: message.content,
      messageType: message.type
    }, user);
  }

  async recipeAddedViaChat(recipe, user) {
    return this.sendEvent('recipe.added_via_chat', {
      recipeId: recipe.id,
      title: recipe.title,
      source: 'chat'
    }, user);
  }

  /**
   * Meal planning events
   */
  async mealPlanCreated(mealPlan, user) {
    return this.sendEvent('meal_plan.created', {
      mealPlanId: mealPlan.id,
      date: mealPlan.date,
      meals: mealPlan.meals
    }, user);
  }

  async mealPlanUpdated(mealPlan, user, changes) {
    return this.sendEvent('meal_plan.updated', {
      mealPlanId: mealPlan.id,
      date: mealPlan.date,
      meals: mealPlan.meals,
      changes
    }, user);
  }

  async mealPlanDeleted(mealPlanId, user) {
    return this.sendEvent('meal_plan.deleted', {
      mealPlanId
    }, user);
  }

  /**
   * Receipt events
   */
  async receiptProcessed(receipt, user) {
    return this.sendEvent('receipt.processed', {
      receiptId: receipt.id,
      total: receipt.total,
      items: receipt.items,
      store: receipt.store,
      date: receipt.date
    }, user);
  }

  /**
   * User preference events
   */
  async preferencesUpdated(preferences, user) {
    return this.sendEvent('preferences.updated', {
      dietaryRestrictions: preferences.dietaryRestrictions,
      allergies: preferences.allergies,
      favoriteIngredients: preferences.favoriteIngredients,
      householdSize: preferences.householdSize
    }, user);
  }

  /**
   * Family member events
   */
  async familyMemberAdded(member, user) {
    return this.sendEvent('family_member.added', {
      memberId: member.id,
      name: member.name,
      relationship: member.relationship,
      age: member.age,
      dietaryRestrictions: member.dietaryRestrictions,
      allergies: member.allergies
    }, user);
  }

  async familyMemberUpdated(member, user, changes) {
    return this.sendEvent('family_member.updated', {
      memberId: member.id,
      name: member.name,
      relationship: member.relationship,
      age: member.age,
      dietaryRestrictions: member.dietaryRestrictions,
      allergies: member.allergies,
      changes
    }, user);
  }

  async familyMemberDeleted(memberId, user) {
    return this.sendEvent('family_member.deleted', {
      memberId
    }, user);
  }

  /**
   * System events
   */
  async userRegistered(user) {
    return this.sendEvent('user.registered', {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      householdSize: user.householdSize
    }, user);
  }

  async userLoggedIn(user) {
    return this.sendEvent('user.logged_in', {
      userId: user.id,
      email: user.email,
      displayName: user.displayName
    }, user);
  }

  /**
   * Custom event for any other use case
   */
  async sendCustomEvent(eventType, data, user = null, metadata = {}) {
    return this.sendEvent(eventType, data, user, metadata);
  }
}

// Create singleton instance
const webhookService = new WebhookService();

export default webhookService;
