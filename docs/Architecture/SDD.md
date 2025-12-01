# Recipe Intelligence Platform - System Design Document

## System Overview

The Recipe Intelligence Platform is a microservices-based application that combines conversational AI, recipe management, and intelligent meal planning. The system leverages Google Cloud services for scalability and AI capabilities, with a React frontend and N8N for workflow automation.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Layer     │    │   N8N Workflows │
│   (Vite/React)  │◄──►│  (Express/Edge) │◄──►│   (AI Agents)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Supabase      │    │   OpenRouter    │    │   Vector Search │
│   (PostgreSQL)  │    │   (AI Models)   │    │   (Future RAG)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Current Implementation
- **Frontend**: Vite + React + TypeScript
- **API Layer**: Express.js (local) + Vercel Edge Functions (production)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenRouter via n8n workflows
- **Deployment**: Vercel for production, local development

## Frontend Architecture (Vite + React)

### Component Structure
```
src/
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx
│   │   ├── MessageBubble.tsx
│   │   └── RecipeInputForm.tsx
│   ├── recipes/
│   │   ├── RecipeList.tsx
│   │   ├── RecipeCard.tsx
│   │   ├── RecipeDetail.tsx
│   │   └── PreferenceTagger.tsx
│   └── common/
│       ├── Layout.tsx
│       ├── Sidebar.tsx
│       └── LoadingSpinner.tsx
├── stores/
│   ├── recipeStore.ts
│   ├── chatStore.ts
│   ├── userStore.ts
│   └── routingStore.ts
├── services/
│   ├── api.ts
│   ├── websocket.ts
│   └── types.ts
├── hooks/
│   ├── useChat.ts
│   ├── useRecipes.ts
│   └── usePreferences.ts
└── utils/
    ├── recipeParser.ts
    └── dateHelpers.ts
```

### State Management (Zustand)

**Recipe Store**
```typescript
interface RecipeStore {
  recipes: Recipe[];
  filters: FilterState;
  selectedRecipe: Recipe | null;
  
  // Actions
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  setFilters: (filters: FilterState) => void;
  searchRecipes: (query: string) => Promise<Recipe[]>;
}
```

**Chat Store**
```typescript
interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  currentContext: ChatContext;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  setContext: (context: ChatContext) => void;
}
```

### API Integration
- **React Query** for server state management and caching
- **WebSocket** connection for real-time chat
- **REST API** for CRUD operations
- **File upload** handling for receipt images

## Backend Architecture (Google Cloud)

### API Gateway (Cloud Run)
**Express.js application serving as the main API layer**

```typescript
// Routes structure
├── /api/v1/
│   ├── /chat          // WebSocket endpoint for chat
│   ├── /recipes       // CRUD operations
│   ├── /preferences   // Family preference management
│   ├── /meal-plans    // Meal planning endpoints
│   ├── /receipts      // Receipt processing
│   └── /grocery-lists // Shopping list generation
```

**Key responsibilities:**
- Authentication and authorization
- Request routing and validation
- Rate limiting and caching
- WebSocket management for chat

### AI Agent Services (Cloud Run)

**Chat Agent Service**
```typescript
interface ChatAgent {
  processMessage(message: string, context: ChatContext): Promise<ChatResponse>;
  parseRecipeFromText(text: string): Promise<ParsedRecipe>;
  generateSuggestions(preferences: FamilyPreferences): Promise<RecipeSuggestion[]>;
}
```

**Recipe Management Agent**
```typescript
interface RecipeAgent {
  extractRecipeData(input: RecipeInput): Promise<StructuredRecipe>;
  validateRecipe(recipe: Recipe): Promise<ValidationResult>;
  scaleRecipe(recipe: Recipe, servings: number): Promise<Recipe>;
  suggestSimilar(recipeId: string): Promise<Recipe[]>;
}
```

**RAG Agent Service**
```typescript
interface RAGAgent {
  indexRecipe(recipe: Recipe): Promise<void>;
  searchSimilar(query: string, filters?: SearchFilters): Promise<SearchResult[]>;
  generateEmbedding(text: string): Promise<number[]>;
  updateIndex(): Promise<void>;
}
```

### Database Design (Firestore)

**Collections Structure:**
```
recipes/
├── {recipeId}/
│   ├── title: string
│   ├── ingredients: Ingredient[]
│   ├── instructions: string[]
│   ├── metadata: RecipeMetadata
│   ├── preferences: FamilyPreferences
│   └── nutritionInfo?: NutritionData

families/
├── {familyId}/
│   ├── members: FamilyMember[]
│   ├── preferences: GlobalPreferences
│   ├── householdSize: number
│   └── dietaryRestrictions: string[]

meal-plans/
├── {planId}/
│   ├── familyId: string
│   ├── startDate: Date
│   ├── meals: PlannedMeal[]
│   └── groceryList: GroceryItem[]

receipts/
├── {receiptId}/
│   ├── familyId: string
│   ├── storeInfo: StoreInfo
│   ├── rawOCRText: string
│   ├── processedItems: ProcessedReceiptItem[]
│   ├── totalAmount: number
│   ├── date: Date
│   ├── processingStatus: 'pending' | 'processed' | 'needs_review'
│   └── userCorrections: UserCorrection[]

purchase-patterns/
├── {familyId}/
│   ├── frequentItems: FrequentItem[]
│   ├── priceHistory: PricePoint[]
│   ├── seasonalTrends: SeasonalData[]
│   ├── storePreferences: StoreData[]
│   └── inventoryPredictions: InventoryEstimate[]
```

**Data Models:**
```typescript
interface Recipe {
  id: string;
  title: string;
  ingredients: Ingredient[];
  instructions: string[];
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  preferences: { [memberId: string]: PreferenceLevel };
  nutritionInfo?: NutritionData;
  createdAt: Date;
  updatedAt: Date;
}

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: IngredientCategory;
  alternatives?: string[];
}

interface FamilyMember {
  id: string;
  name: string;
  dietaryRestrictions: string[];
  allergies: string[];
  preferenceProfile: PreferenceProfile;
}
```

### Vector Search (RAG System)

**Embedding Strategy:**
- Recipe embeddings combine title, ingredients, and cooking methods
- Separate embeddings for ingredients, instructions, and metadata
- Multi-vector search for comprehensive recipe discovery

**Search Architecture:**
```typescript
interface VectorSearchService {
  // Index management
  createRecipeEmbedding(recipe: Recipe): Promise<EmbeddingVector>;
  updateIndex(recipeId: string, embedding: EmbeddingVector): Promise<void>;
  
  // Search operations
  semanticSearch(query: string, limit: number): Promise<SearchResult[]>;
  ingredientBasedSearch(ingredients: string[]): Promise<Recipe[]>;
  similarRecipes(recipeId: string): Promise<Recipe[]>;
}
```

## N8N Workflow Integration

### Workflow Definitions

**Recipe Processing Workflow:**
```
Trigger: New Recipe Added
├── Parse Recipe Content (AI Agent)
├── Extract Ingredients (NLP)
├── Generate Embeddings (Vector Search)
├── Store in Database (Firestore)
└── Notify Users (WebSocket)
```

**Receipt Processing Workflow (N8N):**
```
Trigger: Receipt Image Upload
├── OCR Processing (Google Vision API)
│   └── Extract structured text from receipt image
├── Store Detection & Format Parsing
│   ├── Identify retailer (Walmart, Target, etc.)
│   └── Apply store-specific parsing rules
├── Item Recognition Pipeline
│   ├── Brand Recognition (FAIRLIFE → Fairlife Milk)
│   ├── Abbreviation Expansion (CHO FLIP CD → Chobani Flip Yogurt)
│   ├── Fuzzy Matching for unknown items
│   └── Category Classification (Dairy, Beverages, etc.)
├── Confidence Assessment
│   ├── High Confidence → Auto-categorize and store
│   ├── Medium Confidence → Flag for user review
│   └── Low Confidence → Require manual classification
├── Data Storage & Pattern Analysis
│   ├── Update ingredient database with new items
│   ├── Track price trends and purchase frequency
│   └── Update family shopping patterns
└── User Notification
    ├── Summary of processed items
    ├── Items requiring review/confirmation
    └── Spending insights and trends
```

**Advanced Processing Features:**
- **Multi-item Detection**: Recognize when same item appears multiple times (10x CORE POWER entries)
- **Quantity Normalization**: Convert receipt quantities to cooking measurements
- **Price Trend Analysis**: Track price changes over time for budget optimization
- **Seasonal Pattern Recognition**: Identify seasonal purchasing behaviors
- **Store Comparison**: Compare prices across different retailers
- **Inventory Prediction**: Estimate when commonly purchased items will run out

**Meal Planning Workflow:**
```
Trigger: Weekly Meal Plan Request
├── Analyze Family Preferences
├── Check Ingredient Availability
├── Generate Meal Suggestions (AI)
├── Create Shopping List
└── Send Notifications
```

### Workflow Configuration
- **Webhooks** for triggering workflows from the main application
- **HTTP nodes** for API calls to external services
- **Code nodes** for custom logic and data transformation
- **Schedule triggers** for automated meal planning

## Security Architecture

### Authentication & Authorization
- **Firebase Auth** for user authentication
- **JWT tokens** for API authorization
- **Family-based** access control (multi-user accounts)
- **Role-based permissions** (admin, member, child)

### Data Security
- **Encryption at rest** for sensitive data (Firestore native)
- **TLS encryption** for all API communications
- **API key management** using Secret Manager
- **Input sanitization** for all user inputs

### Privacy Considerations
- **GDPR compliance** for data handling and deletion
- **Data anonymization** for analytics
- **Opt-out mechanisms** for data sharing
- **Family data isolation** (no cross-family access)

## Performance Optimization

### Frontend Optimization
- **Code splitting** by route and component
- **Lazy loading** for non-critical components
- **Image optimization** with WebP format
- **Service Worker** for offline recipe access

### Backend Optimization
- **Caching strategy** with Redis for frequent queries
- **Connection pooling** for database connections
- **CDN** for static assets (Cloud CDN)
- **Auto-scaling** based on CPU and memory usage

### Database Optimization
- **Composite indexes** for common query patterns
- **Denormalization** for read-heavy operations
- **Batch operations** for bulk updates
- **Query optimization** with explain plans

## Deployment Architecture

### CI/CD Pipeline (GitHub Actions)
```yaml
# Simplified workflow
name: Deploy Recipe Platform
on: 
  push: 
    branches: [main]
jobs:
  frontend:
    - Build Vite app
    - Run tests
    - Deploy to Netlify
  backend:
    - Build Docker images
    - Deploy to Cloud Run
    - Update environment configs
  workflows:
    - Deploy N8N workflows
    - Update webhook endpoints
```

### Environment Configuration
- **Development**: Local development with Firebase emulators
- **Staging**: Cloud deployment with test data
- **Production**: Full production setup with monitoring

### Infrastructure as Code
- **Terraform** for Google Cloud resource management
- **Environment variables** managed through Secret Manager
- **Resource quotas** and billing alerts configured

## Monitoring & Observability

### Application Monitoring
- **Cloud Logging** for application logs
- **Cloud Monitoring** for metrics and alerting
- **Error Reporting** for exception tracking
- **Cloud Trace** for request tracing

### Business Metrics
- **User engagement** tracking
- **Recipe usage** analytics
- **Performance metrics** (response times, error rates)
- **Cost monitoring** for cloud resources

### Health Checks
- **Liveness probes** for all services
- **Readiness checks** for deployment validation
- **Synthetic monitoring** for critical user journeys
- **Database health** monitoring

## Scalability Considerations

### Horizontal Scaling
- **Stateless services** for easy horizontal scaling
- **Load balancing** with Cloud Load Balancer
- **Auto-scaling groups** for Cloud Run services
- **Database sharding** strategy for large datasets

### Vertical Scaling
- **Resource optimization** based on usage patterns
- **Memory management** for embedding storage
- **CPU optimization** for ML inference
- **Storage tiering** for different data types

### Cost Optimization
- **Serverless architecture** to minimize idle costs
- **Efficient querying** to reduce database costs
- **Image optimization** to reduce storage costs
- **Caching strategies** to reduce API calls

## Future Considerations

### Technical Debt Management
- **Regular dependency updates**
- **Code quality monitoring** with SonarQube
- **Performance regression testing**
- **Architecture review cycles**

### Feature Extensibility
- **Plugin architecture** for third-party integrations
- **API versioning** strategy for backward compatibility
- **Modular design** for easy feature addition
- **Configuration management** for feature flags

### Technology Evolution
- **AI model upgrades** (Vertex AI updates)
- **Framework migrations** (React version updates)
- **Cloud service evolution** (new Google Cloud features)
- **Mobile app consideration** (React Native)