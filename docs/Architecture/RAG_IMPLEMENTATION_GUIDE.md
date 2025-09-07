# RAG-Enhanced MealPrep Agent Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the RAG-enhanced chat system that converts natural text to recipes, stores them in PostgreSQL, and provides intelligent recipe-aware responses.

## Architecture Summary

### 1. Recipe Extraction Pipeline
- **Input**: Natural language text (recipes, cooking instructions)
- **Processing**: n8n AI Agent with specialized recipe extraction prompt
- **Output**: Structured recipe JSON stored in PostgreSQL
- **Enhancement**: Automatic embedding generation for semantic search

### 2. RAG System
- **Vector Search**: Semantic similarity using OpenAI embeddings
- **Text Search**: Full-text search using PostgreSQL
- **Hybrid Search**: Combines both approaches for optimal results
- **Context Injection**: Relevant recipes provided to AI for informed responses

### 3. Optimized Chat Flow
- **Intent Detection**: Automatically routes queries to appropriate handlers
- **Fast Model**: Uses smaller, faster model for recipe extraction
- **Context-Aware**: Provides recipe context for intelligent responses

## Implementation Steps

### Step 1: Database Setup

1. **Run Migrations**:
   ```bash
   # Apply the new migrations
   psql -d your_database -f migrations/008_add_rag_support.sql
   psql -d your_database -f migrations/009_add_semantic_search_functions.sql
   ```

2. **Verify Extensions**:
   ```sql
   -- Check if vector extension is installed
   SELECT * FROM pg_extension WHERE extname = 'vector';
   
   -- Check if uuid extension is installed
   SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';
   ```

### Step 2: Environment Configuration

1. **Add Environment Variables**:
   ```bash
   # .env file
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```

2. **Update n8n Configuration**:
   - Import the new n8n configuration from `docs/n8n-rag-config.md`
   - Update webhook URL if needed
   - Configure OpenRouter API credentials

### Step 3: Backend Setup

1. **Install Dependencies**:
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Update Server Configuration**:
   - The RAG API endpoints are already added to `server.js`
   - Ensure the `backend/rag-api.js` file is properly configured

### Step 4: Frontend Integration

1. **Update Chat Interface**:
   - The `ChatInterface.tsx` has been updated with intent detection
   - RAG service integration is already implemented
   - Visual indicators for different query types added

2. **API Service Updates**:
   - `ragService.ts` provides all RAG functionality
   - Intent detection automatically routes queries
   - Context formatting for AI responses

## Usage Examples

### Recipe Extraction
```
User: "Here's my grandma's chocolate chip cookie recipe: 2 cups flour, 1 cup sugar, 1/2 cup butter, 2 eggs, 1 tsp vanilla, 1 cup chocolate chips. Mix dry ingredients, cream butter and sugar, add eggs and vanilla, combine with dry ingredients, fold in chocolate chips, bake at 375°F for 10-12 minutes."

AI: [Extracts structured recipe and stores in database]
```

### Recipe Search
```
User: "Find recipes with chicken and rice"

AI: [Searches database using semantic similarity and returns relevant recipes with context]
```

### Ingredient-Based Search
```
User: "What can I make with eggs, flour, and milk?"

AI: [Searches for recipes containing these ingredients and provides suggestions]
```

### Cooking Advice
```
User: "How do I make my pasta sauce less acidic?"

AI: [Provides cooking advice, potentially referencing stored recipes]
```

## Performance Optimizations

### 1. Model Selection
- **Recipe Extraction**: Uses `gemma-2-9b-it` (faster, smaller model)
- **General Chat**: Uses same model for consistency
- **System Prompts**: Optimized for specific tasks

### 2. Database Optimizations
- **Vector Indexes**: IVFFlat indexes for fast similarity search
- **Text Indexes**: GIN indexes for full-text search
- **Composite Indexes**: User + embedding combinations

### 3. Caching Strategy
- **Embedding Cache**: Store generated embeddings
- **Search Results**: Cache frequent queries
- **Recipe Context**: Cache formatted context

## Monitoring and Analytics

### 1. Search Analytics
- Track search queries and results
- Monitor search performance
- Analyze user preferences

### 2. Recipe Analytics
- Track recipe extraction success rates
- Monitor embedding generation
- Analyze recipe popularity

### 3. Performance Metrics
- Response times for different query types
- Database query performance
- AI model response times

## Troubleshooting

### Common Issues

#### 1. Embedding Generation Fails
- **Cause**: OpenAI API key issues or rate limits
- **Solution**: Check API key and implement retry logic
- **Fallback**: Use text search only

#### 2. Vector Search Returns No Results
- **Cause**: No embeddings generated or low similarity threshold
- **Solution**: Lower threshold or generate embeddings for existing recipes
- **Fallback**: Use text search

#### 3. Intent Detection Incorrect
- **Cause**: Ambiguous user input
- **Solution**: Improve keyword matching or add user confirmation
- **Fallback**: Default to general chat

### Debug Information
- Check browser console for intent detection logs
- Monitor n8n execution logs
- Review database query performance
- Check OpenAI API usage

## Future Enhancements

### 1. Advanced Features
- **Recipe Recommendations**: ML-based suggestions
- **Meal Planning**: AI-powered meal planning
- **Nutrition Analysis**: Automatic nutrition calculation
- **Shopping Lists**: Generate from recipes

### 2. Performance Improvements
- **Streaming Responses**: Real-time response streaming
- **Batch Processing**: Bulk recipe processing
- **Edge Caching**: CDN for static content
- **Database Sharding**: Scale for large recipe collections

### 3. User Experience
- **Voice Input**: Speech-to-text for recipes
- **Image Recognition**: Extract recipes from photos
- **Recipe Sharing**: Share recipes with others
- **Offline Mode**: Work without internet connection

## Conclusion

The RAG-enhanced MealPrep Agent provides a powerful foundation for recipe management and intelligent cooking assistance. The system balances performance, accuracy, and user experience while maintaining scalability for future growth.

Key benefits:
- **Speed**: Optimized for fast responses
- **Intelligence**: Context-aware recipe assistance
- **Scalability**: Handles large recipe collections
- **Flexibility**: Supports multiple query types
- **Accuracy**: Semantic search with fallbacks
