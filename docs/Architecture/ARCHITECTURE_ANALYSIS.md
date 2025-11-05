# MealPrep Agent - Comprehensive Architecture Analysis

## Executive Summary

MealPrep Agent is an AI-powered meal planning and recipe management system designed for families. The platform combines conversational AI, automated grocery planning, and personalized recipe recommendations using a modern full-stack architecture with RAG (Retrieval-Augmented Generation) capabilities.

## Core Architecture Overview

### Technology Stack

**Frontend:**
- Framework: React 18 with TypeScript
- Build Tool: Vite 4
- State Management: Zustand
- Data Fetching: React Query (TanStack Query)
- Routing: React Router v6
- Styling: Tailwind CSS with dark mode support
- UI Components: Radix UI + custom components
- Forms: React Hook Form
- Icons: Lucide React

**Backend:**
- Runtime: Node.js with Express.js
- Database: PostgreSQL (Neon) with pgvector extension
- Authentication: StackFrame (Stack Auth)
- AI Integration: n8n webhooks for workflow orchestration
- Embeddings: OpenAI (via OpenRouter) - text-embedding-ada-002
- Deployment: Vercel (Edge Functions + Serverless)

**Infrastructure:**
- Database: Neon PostgreSQL with vector search capabilities
- Vector Storage: pgvector extension for semantic search
- Workflow Automation: n8n for AI agent orchestration
- Edge Computing: Vercel Edge Functions

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend]
        Auth[Stack Auth Client]
    end
    
    subgraph "Application Layer"
        API[Express Server]
        Edge[Vercel Edge Functions]
    end
    
    subgraph "Services Layer"
        Chat[Chat Service]
        RAG[RAG Service]
        Embed[Embedding Service]
        DB[Database Service]
    end
    
    subgraph "External Services"
        N8N[n8n Workflow]
        OpenAI[OpenAI/OpenRouter]
        Neon[Neon PostgreSQL]
    end
    
    UI --> Auth
    UI --> API
    UI --> Edge
    API --> Chat
    API --> RAG
    API --> Embed
    API --> DB
    Edge --> Chat
    Edge --> N8N
    Chat --> N8N
    RAG --> Embed
    RAG --> DB
    Embed --> OpenAI
    DB --> Neon
    N8N --> OpenAI
```

## Component Architecture

```mermaid
graph LR
    subgraph "Frontend Components"
        Pages[Pages]
        Layout[Layout]
        ChatComp[Chat Components]
        RecipeComp[Recipe Components]
        AuthComp[Auth Components]
        UIComp[UI Components]
    end
    
    subgraph "Services"
        APIService[API Service]
        ChatAPI[Chat API]
        RAGService[RAG Service]
        NeonService[Neon Service]
        EmbedService[Embedding Service]
    end
    
    subgraph "State Management"
        AuthStore[Auth Store]
        ThemeStore[Theme Store]
    end
    
    Pages --> Layout
    Layout --> ChatComp
    Layout --> RecipeComp
    Layout --> AuthComp
    ChatComp --> ChatAPI
    RecipeComp --> APIService
    AuthComp --> AuthStore
    ChatAPI --> RAGService
    RAGService --> EmbedService
    APIService --> NeonService
    AuthStore --> NeonService
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant N8N
    participant OpenAI
    participant Database
    participant Embedding
    
    User->>Frontend: Send Message
    Frontend->>API: POST /api/chat/message
    API->>Database: Store User Message
    API->>N8N: Webhook Request
    N8N->>OpenAI: AI Processing
    OpenAI->>N8N: AI Response
    N8N->>API: Webhook Response
    API->>Database: Store AI Response
    API->>Frontend: Return Response
    Frontend->>User: Display Message
    
    Note over User,Embedding: Recipe Search Flow
    User->>Frontend: Search Recipe
    Frontend->>API: POST /api/rag/search
    API->>Embedding: Generate Query Embedding
    Embedding->>OpenAI: Create Embedding
    OpenAI->>Embedding: Return Vector
    Embedding->>Database: Vector Search
    Database->>API: Similar Recipes
    API->>Frontend: Search Results
    Frontend->>User: Display Recipes
```

## Database Schema Architecture

```mermaid
erDiagram
    USERS ||--o{ RECIPES : has
    USERS ||--o{ CHAT_MESSAGES : sends
    RECIPES ||--o{ RECIPE_EMBEDDINGS : has
    RECIPES ||--o{ MEAL_PLANS : used_in
    
    USERS {
        uuid id PK
        string email
        string display_name
        timestamp created_at
    }
    
    RECIPES {
        uuid id PK
        uuid user_id FK
        string title
        text description
        jsonb ingredients
        jsonb instructions
        string prep_time
        string cook_time
        integer servings
        string difficulty
        string cuisine
        text[] dietary_tags
        vector embedding_vector
        text searchable_text
        timestamp created_at
    }
    
    RECIPE_EMBEDDINGS {
        uuid id PK
        uuid recipe_id FK
        vector embedding
        text text_content
        string embedding_type
        timestamp created_at
    }
    
    CHAT_MESSAGES {
        uuid id PK
        uuid user_id FK
        text content
        string sender
        string message_type
        jsonb metadata
        timestamp created_at
    }
    
    MEAL_PLANS {
        uuid id PK
        uuid user_id FK
        date start_date
        date end_date
        jsonb meals
        timestamp created_at
    }
```

## Chat Flow Architecture

```mermaid
flowchart TD
    Start([User Sends Message]) --> Intent[Detect Intent]
    Intent -->|Recipe Extraction| Extract[Recipe Extraction Flow]
    Intent -->|Recipe Search| Search[Recipe Search Flow]
    Intent -->|General Chat| General[General Chat Flow]
    
    Extract --> N8N1[Send to n8n]
    N8N1 --> Parse[Parse Recipe]
    Parse --> Store[Store Recipe]
    Store --> Embed1[Generate Embedding]
    Embed1 --> Response1[Return Response]
    
    Search --> Embed2[Generate Query Embedding]
    Embed2 --> Vector[Vector Search]
    Vector --> Context[Format Context]
    Context --> N8N2[Send to n8n with Context]
    N8N2 --> Response2[Return Response]
    
    General --> N8N3[Send to n8n]
    N8N3 --> Response3[Return Response]
    
    Response1 --> End([Display Response])
    Response2 --> End
    Response3 --> End
```

## RAG System Architecture

```mermaid
graph TB
    subgraph "RAG Pipeline"
        Query[User Query] --> Intent[Intent Detection]
        Intent -->|Semantic| Semantic[Semantic Search]
        Intent -->|Text| Text[Text Search]
        Intent -->|Hybrid| Hybrid[Hybrid Search]
        Intent -->|Ingredients| Ingredient[Ingredient Search]
        
        Semantic --> Embed[Generate Embedding]
        Embed --> Vector[Vector Similarity Search]
        Vector --> Results[Recipe Results]
        
        Text --> FullText[Full-Text Search]
        FullText --> Results
        
        Hybrid --> Embed
        Hybrid --> FullText
        Hybrid --> Merge[Merge Results]
        Merge --> Results
        
        Ingredient --> IngredientSearch[Ingredient Match Search]
        IngredientSearch --> Results
        
        Results --> Context[Format Context]
        Context --> AI[AI Response Generation]
    end
    
    subgraph "Embedding Generation"
        Recipe[Recipe Data] --> TextGen[Generate Text]
        TextGen --> EmbedAPI[OpenAI Embedding API]
        EmbedAPI --> VectorStore[Store Vector]
    end
    
    VectorStore -.-> Vector
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant AuthStore
    participant StackAuth
    participant Database
    
    Note over User,Database: Sign Up Flow
    User->>Frontend: Enter Credentials
    Frontend->>AuthStore: signUp()
    AuthStore->>StackAuth: signUpWithCredential()
    StackAuth->>Database: Create User
    Database->>StackAuth: User Created
    StackAuth->>AuthStore: Success
    AuthStore->>Frontend: Update State
    Frontend->>User: Redirect to Dashboard
    
    Note over User,Database: Sign In Flow
    User->>Frontend: Enter Credentials
    Frontend->>AuthStore: signIn()
    AuthStore->>StackAuth: signInWithCredential()
    StackAuth->>Database: Verify User
    Database->>StackAuth: User Valid
    StackAuth->>AuthStore: Token
    AuthStore->>Frontend: Update State
    Frontend->>User: Redirect to Dashboard
    
    Note over User,Database: Protected Route
    User->>Frontend: Access Protected Page
    Frontend->>AuthStore: Check Auth
    AuthStore->>StackAuth: getUser()
    StackAuth->>AuthStore: User or Null
    alt User Authenticated
        AuthStore->>Frontend: Allow Access
    else User Not Authenticated
        AuthStore->>Frontend: Redirect to Sign In
    end
```

## Request-Response Flow

```mermaid
sequenceDiagram
    participant Browser
    participant React App
    participant API Client
    participant Express Server
    participant Database
    participant N8N
    participant OpenAI
    
    Browser->>React App: User Interaction
    React App->>API Client: API Call
    API Client->>Express Server: HTTP Request
    
    alt Chat Message
        Express Server->>Database: Store Message
        Express Server->>N8N: Webhook POST
        N8N->>OpenAI: Process with AI
        OpenAI->>N8N: AI Response
        N8N->>Express Server: Response
        Express Server->>Database: Store Response
    else Recipe Search
        Express Server->>OpenAI: Generate Embedding
        OpenAI->>Express Server: Vector
        Express Server->>Database: Vector Search
        Database->>Express Server: Results
    else Recipe CRUD
        Express Server->>Database: Query/Update
        Database->>Express Server: Result
    end
    
    Express Server->>API Client: JSON Response
    API Client->>React App: Data Update
    React App->>Browser: UI Update
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        Vercel[Vercel Platform]
        Edge[Edge Functions]
        Serverless[Serverless Functions]
        Frontend[Static Frontend]
    end
    
    subgraph "External Services"
        NeonDB[Neon Database]
        N8NServer[n8n Server]
        OpenRouter[OpenRouter API]
    end
    
    Frontend --> Edge
    Frontend --> Serverless
    Edge --> NeonDB
    Edge --> N8NServer
    Serverless --> NeonDB
    Serverless --> N8NServer
    N8NServer --> OpenRouter
    Edge --> OpenRouter
```

## Key Design Patterns

### 1. Service Layer Pattern
- **Location**: `src/services/`
- **Purpose**: Abstracts API calls and business logic
- **Services**: `api.ts`, `chatApi.ts`, `ragService.ts`, `embeddingService.ts`, `database.ts`

### 2. Repository Pattern
- **Location**: `src/services/database.ts`
- **Purpose**: Encapsulates database operations
- **Methods**: CRUD operations for recipes, embeddings, and chat messages

### 3. State Management Pattern
- **Location**: `src/stores/`
- **Purpose**: Centralized state management with Zustand
- **Stores**: `authStore.ts`, `themeStore.ts`

### 4. Component Composition Pattern
- **Location**: `src/components/`
- **Purpose**: Reusable, composable UI components
- **Structure**: Pages → Layout → Feature Components → UI Components

### 5. RAG Pattern
- **Location**: `src/services/ragService.ts`, `server.js`
- **Purpose**: Retrieval-Augmented Generation for context-aware responses
- **Flow**: Query → Embedding → Vector Search → Context Injection → AI Response

## Data Flow Patterns

### Chat Message Flow
1. User sends message via `ChatInterface`
2. Intent detection via `detectIntent()` in `ragService.ts`
3. Route to appropriate handler:
   - Recipe extraction → n8n webhook
   - Recipe search → RAG search + n8n
   - General chat → n8n webhook
4. Response stored in conversation state
5. UI updates with new message

### Recipe Storage Flow
1. Recipe data received from n8n or user input
2. Stored in PostgreSQL via `database.ts`
3. Text content generated for embedding
4. Embedding generated via OpenAI API
5. Vector stored in `recipe_embeddings` table
6. Recipe searchable via semantic search

### RAG Search Flow
1. User query received
2. Query embedding generated
3. Vector similarity search in database
4. Top-K recipes retrieved
5. Context formatted for AI
6. Context injected into n8n workflow
7. AI generates response with recipe context

## API Endpoints

### Chat Endpoints
- `POST /api/chat/message` - Send chat message
- `GET /api/chat/history` - Get chat history
- `DELETE /api/chat/history` - Clear chat history

### Recipe Endpoints
- `GET /api/recipes` - Get all recipes
- `GET /api/recipes/:id` - Get single recipe
- `POST /api/recipes` - Create recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe

### RAG Endpoints
- `POST /api/rag/search` - Semantic search
- `POST /api/rag/ingredients` - Ingredient-based search
- `GET /api/rag/similar/:recipeId` - Find similar recipes
- `POST /api/rag/recommendations` - Get recommendations
- `POST /api/rag/embedding` - Generate embedding

### Health Endpoints
- `GET /api/health` - Health check
- `GET /api/test-webhook` - Test n8n webhook

## Security Architecture

### Authentication
- **Provider**: StackFrame (Stack Auth)
- **Method**: Credential-based (email/password)
- **Storage**: Cookie-based token storage
- **Protection**: Protected routes via `ProtectedRoute` component

### Authorization
- **Database**: Row-Level Security (RLS) enabled
- **User Isolation**: All queries filtered by `user_id`
- **API**: User context extracted from auth token

### Data Protection
- **HTTPS**: All communications encrypted
- **Environment Variables**: Sensitive data in `.env`
- **CORS**: Configured for specific origins

## Performance Optimizations

### Frontend
- **Code Splitting**: Lazy loading of routes
- **React Query**: Caching and automatic refetching
- **Memoization**: React.memo for expensive components
- **Virtual Scrolling**: For large lists (future)

### Backend
- **Connection Pooling**: PostgreSQL connection pool
- **Vector Indexing**: IVFFlat indexes for fast vector search
- **Edge Functions**: Low-latency edge computing
- **Caching**: React Query cache on frontend

### Database
- **Indexes**: Strategic indexes on frequently queried columns
- **Vector Indexes**: IVFFlat indexes for embedding vectors
- **Full-Text Search**: PostgreSQL full-text search indexes
- **Query Optimization**: Efficient SQL queries with proper joins

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: Serverless functions can scale independently
- **Database**: Neon PostgreSQL supports horizontal scaling
- **Edge Functions**: Automatically scales with traffic

### Vertical Scaling
- **Database**: Can upgrade Neon instance for more resources
- **Vector Search**: Optimized with proper indexes
- **Caching**: React Query reduces database load

### Future Enhancements
- **CDN**: For static assets
- **Redis**: For session and cache management
- **Message Queue**: For async processing
- **Load Balancing**: For n8n instances

## Error Handling

### Frontend
- **React Query**: Automatic error handling and retries
- **Error Boundaries**: Catch component errors
- **Toast Notifications**: User-friendly error messages
- **Fallback UI**: Graceful degradation

### Backend
- **Try-Catch**: Comprehensive error handling
- **HTTP Status Codes**: Proper status code usage
- **Error Logging**: Console logging for debugging
- **Graceful Degradation**: Fallback responses when services unavailable

## Monitoring & Logging

### Current Implementation
- **Console Logging**: Detailed logs for debugging
- **Error Tracking**: Error messages logged to console
- **Health Checks**: `/api/health` endpoint

### Future Enhancements
- **Application Monitoring**: Sentry or similar
- **Performance Monitoring**: Vercel Analytics
- **Database Monitoring**: Neon dashboard
- **Log Aggregation**: Centralized logging system

## Development Workflow

### Local Development
1. Frontend: `npm run dev` (Vite dev server)
2. Backend: `npm run server` (Express server)
3. Database: Neon cloud database
4. n8n: External n8n server

### Build Process
1. TypeScript compilation
2. Vite build
3. Static asset optimization
4. Deployment to Vercel

### Testing Strategy
- **Unit Tests**: Component and service tests (future)
- **Integration Tests**: API endpoint tests (future)
- **E2E Tests**: User flow tests (future)

## Conclusion

The MealPrep Agent architecture is designed for:
- **Scalability**: Serverless and edge computing
- **Performance**: Vector search and caching
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Modular service architecture
- **User Experience**: Fast, responsive interface

The system leverages modern technologies and best practices to provide a robust, scalable platform for AI-powered meal planning and recipe management.

