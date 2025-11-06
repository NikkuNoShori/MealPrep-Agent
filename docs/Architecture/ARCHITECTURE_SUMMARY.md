# MealPrep Agent - Architecture Summary

## Quick Reference

### System Overview
MealPrep Agent is a full-stack AI-powered meal planning application built with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon) with pgvector
- **AI**: OpenAI embeddings + n8n workflows
- **Auth**: StackFrame (Stack Auth)
- **Deployment**: Vercel

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Pages   │  │ Layout   │  │ Components│            │
│  └──────────┘  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Stores  │  │ Services │  │   API    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                Backend (Express.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │   Chat    │  │   RAG     │  │ Embedding│            │
│  │  Service  │  │  Service  │  │  Service │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│  ┌──────────┐  ┌──────────┐                          │
│  │ Database │  │  Webhook  │                          │
│  │  Service  │  │  Service  │                          │
│  └──────────┘  └──────────┘                          │
└─────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Neon DB    │  │    n8n       │  │   OpenAI     │
│  PostgreSQL  │  │  Workflows   │  │  Embeddings  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Key Flows

#### 1. Chat Flow
```
User → ChatInterface → API → n8n → OpenAI → n8n → API → ChatInterface
```

#### 2. Recipe Search Flow
```
User → RAG Service → Embedding Service → OpenAI → Database → Vector Search → Results
```

#### 3. Recipe Storage Flow
```
n8n → API → Database → Embedding Service → OpenAI → Database (embeddings)
```

#### 4. Authentication Flow
```
User → Sign In/Up → Stack Auth → Cookie Set → Zustand Store → Protected Route
User → Page Refresh → Stack Auth Cookies → Zustand Store → Protected Route
```

### Technology Decisions

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend Framework | React + TypeScript | Type safety, large ecosystem |
| Build Tool | Vite | Fast development, optimized builds |
| State Management | Zustand | Lightweight, simple API |
| Data Fetching | React Query | Caching, automatic refetching |
| Database | PostgreSQL (Neon) | Relational + vector support |
| Vector Search | pgvector | Native PostgreSQL extension |
| AI Embeddings | OpenAI | High-quality embeddings |
| Workflow | n8n | Visual workflow automation |
| Authentication | Stack Auth (StackFrame) | Cookie-based auth with session persistence |
| Deployment | Vercel | Serverless, edge functions |

### Directory Structure

```
MealPrep-Agent/
├── src/
│   ├── components/      # React components
│   │   ├── auth/        # Authentication components
│   │   ├── chat/         # Chat interface
│   │   ├── recipes/      # Recipe management
│   │   ├── common/       # Shared components
│   │   └── ui/           # UI primitives
│   ├── pages/            # Page components
│   ├── services/         # API and business logic
│   ├── stores/           # Zustand stores
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── server.js             # Express server
├── api/                  # API routes
├── backend/              # Backend services
├── migrations/           # Database migrations
└── docs/                 # Documentation
```

### Key Features

1. **Conversational AI**: Natural language interaction via n8n workflows
2. **RAG System**: Context-aware responses using vector search
3. **Recipe Management**: CRUD operations with semantic search
4. **User Authentication**: Secure auth with Stack Auth (cookie-based sessions)
   - Sign up, sign in, sign out
   - Password reset and forgot password flows
   - Session persistence across page refreshes
   - Protected routes with automatic redirects
5. **Session Management**: Temporary and persistent chat sessions
6. **Theme Support**: Light/dark mode with system preference

### API Structure

```
/api/
├── chat/
│   ├── POST /message      # Send message
│   ├── GET /history        # Get history
│   └── DELETE /history     # Clear history
├── recipes/
│   ├── GET /               # List recipes
│   ├── GET /:id            # Get recipe
│   ├── POST /              # Create recipe
│   ├── PUT /:id            # Update recipe
│   └── DELETE /:id        # Delete recipe
├── rag/
│   ├── POST /search        # Semantic search
│   ├── POST /ingredients   # Ingredient search
│   ├── GET /similar/:id    # Similar recipes
│   ├── POST /recommendations # Recommendations
│   └── POST /embedding     # Generate embedding
└── health/
    └── GET /               # Health check
```

### Database Schema (Simplified)

```
users
├── id (UUID, PK)
├── email
└── created_at

recipes
├── id (UUID, PK)
├── user_id (FK → users)
├── title
├── ingredients (JSONB)
├── instructions (JSONB)
├── embedding_vector (VECTOR)
└── created_at

recipe_embeddings
├── id (UUID, PK)
├── recipe_id (FK → recipes)
├── embedding (VECTOR)
└── text_content

chat_messages
├── id (UUID, PK)
├── user_id (FK → users)
├── content
├── sender
└── created_at
```

### Security Model

- **Authentication**: Stack Auth (StackFrame) with cookie-based session persistence
  - Token storage: HTTP-only cookies (not localStorage)
  - Session persistence: Automatic via Stack Auth cookies
  - Auth state management: Zustand store synced with Stack Auth cookies
  - Features: Sign up, sign in, sign out, password reset, forgot password
  - Protected routes: React Router with ProtectedRoute component
- **Authorization**: Row-Level Security (RLS) in database
- **Data Isolation**: All queries filtered by user_id
- **HTTPS**: All communications encrypted
- **CORS**: Configured for specific origins

### Performance Characteristics

- **Frontend**: Code splitting, lazy loading, React Query caching
- **Backend**: Connection pooling, optimized queries
- **Database**: Vector indexes (IVFFlat), full-text search indexes
- **Edge**: Low-latency edge functions

### Scalability

- **Horizontal**: Serverless functions scale automatically
- **Database**: Neon supports horizontal scaling
- **Caching**: React Query reduces database load
- **Vector Search**: Optimized with proper indexes

### Development Workflow

1. **Local Development**
   - Frontend: `npm run dev` (Vite)
   - Backend: `npm run server` (Express)
   - Database: Neon cloud instance

2. **Build & Deploy**
   - TypeScript compilation
   - Vite build
   - Deploy to Vercel

### Future Enhancements

- [ ] Unit and integration tests
- [ ] Redis caching layer
- [ ] Message queue for async processing
- [ ] CDN for static assets
- [ ] Application monitoring (Sentry)
- [ ] Performance monitoring (Vercel Analytics)

---

For detailed architecture information, see [ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md)

