# MealPrep Agent - Architecture Diagrams

This file contains all Mermaid diagrams for the MealPrep Agent architecture. These diagrams can be rendered in any Markdown viewer that supports Mermaid (GitHub, GitLab, VS Code with Mermaid extension, etc.).

## System Architecture

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
    Layout --> UIComp
    ChatComp --> ChatAPI
    RecipeComp --> APIService
    AuthComp --> AuthStore
    ChatAPI --> RAGService
    RAGService --> EmbedService
    APIService --> NeonService
    AuthStore --> NeonService
```

## Data Flow Sequence

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

## Database Schema

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

---

**Note**: These diagrams can be viewed in:
- GitHub/GitLab (native Mermaid support)
- VS Code (with Mermaid extension)
- Online Mermaid editors (mermaid.live)
- Documentation sites (MkDocs, Docusaurus, etc.)

