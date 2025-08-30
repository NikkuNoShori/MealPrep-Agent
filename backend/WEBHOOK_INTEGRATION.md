# Webhook Integration with n8n

This document describes how to configure and use the webhook integration between the MealPrep API and n8n for automation workflows.

## Overview

The API automatically sends webhook events to n8n when certain actions occur in the application. This allows you to create automated workflows in n8n that respond to user activities.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Webhook Configuration
WEBHOOK_ENABLED=true
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/meal-prep-events
```

### n8n Webhook Setup

1. **Create a Webhook Node in n8n:**
   - Add a "Webhook" node to your workflow
   - Set the HTTP method to `POST`
   - Copy the webhook URL provided by n8n
   - Use this URL as your `N8N_WEBHOOK_URL`

2. **Configure the Webhook Node:**
   - Set the response mode to "Respond to Webhook"
   - Enable "Respond with all defined fields"

## Available Events

### Recipe Events

#### `recipe.created`
Triggered when a new recipe is created.

**Payload:**
```json
{
  "eventType": "recipe.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "recipeId": "123",
    "title": "Chicken Pasta",
    "ingredients": [...],
    "instructions": [...],
    "servings": 4,
    "difficulty": "medium",
    "prepTime": 15,
    "cookTime": 30,
    "tags": ["pasta", "chicken"]
  },
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "displayName": "John Doe"
  },
  "metadata": {
    "source": "meal-prep-api",
    "version": "1.0.0"
  }
}
```

#### `recipe.updated`
Triggered when a recipe is updated.

**Payload:**
```json
{
  "eventType": "recipe.updated",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "recipeId": "123",
    "title": "Chicken Pasta",
    "changes": {
      "title": "updated",
      "servings": "updated"
    },
    "ingredients": [...],
    "instructions": [...],
    "servings": 6,
    "difficulty": "medium",
    "prepTime": 15,
    "cookTime": 30,
    "tags": ["pasta", "chicken"]
  },
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

#### `recipe.deleted`
Triggered when a recipe is deleted.

**Payload:**
```json
{
  "eventType": "recipe.deleted",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "recipeId": "123"
  },
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

### Chat Events

#### `chat.message_sent`
Triggered when a user sends a chat message.

**Payload:**
```json
{
  "eventType": "chat.message_sent",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "messageId": "msg123",
    "content": "How do I make pasta?",
    "messageType": "text"
  },
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

#### `recipe.added_via_chat`
Triggered when a recipe is added through the chat interface.

**Payload:**
```json
{
  "eventType": "recipe.added_via_chat",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "recipeId": "123",
    "title": "Chicken Pasta",
    "source": "chat"
  },
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

### Meal Planning Events

#### `meal_plan.created`
Triggered when a meal plan is created.

#### `meal_plan.updated`
Triggered when a meal plan is updated.

#### `meal_plan.deleted`
Triggered when a meal plan is deleted.

### Receipt Events

#### `receipt.processed`
Triggered when a receipt is processed.

### User Events

#### `user.registered`
Triggered when a new user registers.

#### `user.logged_in`
Triggered when a user logs in.

### Family Member Events

#### `family_member.added`
Triggered when a family member is added.

#### `family_member.updated`
Triggered when a family member is updated.

#### `family_member.deleted`
Triggered when a family member is deleted.

### Preference Events

#### `preferences.updated`
Triggered when user preferences are updated.

## Testing Webhooks

### Test Endpoint

Use the test endpoint to verify your webhook configuration:

```bash
POST /api/webhooks/test
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "eventType": "test.event",
  "data": {
    "message": "Test webhook"
  },
  "metadata": {
    "test": true
  }
}
```

### Status Endpoint

Check webhook configuration status:

```bash
GET /api/webhooks/status
Authorization: Bearer <your-token>
```

### Custom Event Endpoint

Send custom events:

```bash
POST /api/webhooks/event
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "eventType": "custom.event",
  "data": {
    "customField": "value"
  }
}
```

## n8n Workflow Examples

### Example 1: Recipe Creation Notification

Create a workflow that sends a notification when a new recipe is created:

1. **Webhook Node** - Receives the `recipe.created` event
2. **IF Node** - Checks if `eventType` equals `recipe.created`
3. **Email Node** - Sends notification email
4. **Slack Node** - Posts to Slack channel

### Example 2: Recipe Analytics

Create a workflow that tracks recipe creation analytics:

1. **Webhook Node** - Receives recipe events
2. **IF Node** - Filters for recipe events
3. **Google Sheets Node** - Logs recipe data to spreadsheet
4. **Chart Node** - Creates analytics dashboard

### Example 3: Meal Plan Reminders

Create a workflow that sends meal plan reminders:

1. **Webhook Node** - Receives `meal_plan.created` events
2. **Wait Node** - Waits until meal plan date
3. **Email Node** - Sends reminder email
4. **SMS Node** - Sends SMS reminder

### Example 4: Shopping List Generation

Create a workflow that generates shopping lists:

1. **Webhook Node** - Receives `meal_plan.created` events
2. **HTTP Request Node** - Fetches recipe ingredients
3. **Code Node** - Processes ingredients into shopping list
4. **Google Docs Node** - Creates shopping list document

## Error Handling

The webhook service includes built-in error handling:

- **Timeout**: 10-second timeout for webhook requests
- **Non-blocking**: Webhook failures don't affect the main API flow
- **Logging**: All webhook attempts are logged
- **Retry**: Failed webhooks are logged but not retried (implement retry logic in n8n if needed)

## Security Considerations

1. **Authentication**: All webhook endpoints require authentication
2. **Rate Limiting**: Webhook requests are subject to rate limiting
3. **Validation**: Event data is validated before sending
4. **Logging**: All webhook activity is logged for monitoring

## Monitoring

Monitor webhook activity through:

1. **API Logs**: Check server logs for webhook success/failure messages
2. **n8n Logs**: Check n8n execution logs for received webhooks
3. **Status Endpoint**: Use `/api/webhooks/status` to check configuration
4. **Test Endpoint**: Use `/api/webhooks/test` to verify connectivity

## Troubleshooting

### Common Issues

1. **Webhook not received in n8n:**
   - Check `N8N_WEBHOOK_URL` configuration
   - Verify n8n webhook node is active
   - Check network connectivity

2. **Authentication errors:**
   - Ensure valid authentication token
   - Check user permissions

3. **Timeout errors:**
   - Check n8n response time
   - Verify webhook URL is accessible

4. **Event not triggering:**
   - Check `WEBHOOK_ENABLED` setting
   - Verify event is implemented in the relevant route

### Debug Steps

1. Check webhook status: `GET /api/webhooks/status`
2. Test webhook: `POST /api/webhooks/test`
3. Check API logs for webhook messages
4. Verify n8n webhook node configuration
5. Test n8n webhook URL directly with curl

## Best Practices

1. **Idempotency**: Design n8n workflows to handle duplicate events
2. **Error Handling**: Implement proper error handling in n8n workflows
3. **Monitoring**: Set up alerts for webhook failures
4. **Testing**: Test workflows with the test endpoint before going live
5. **Documentation**: Document your n8n workflows and their purposes
