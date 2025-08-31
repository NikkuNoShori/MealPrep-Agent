# Architecture Decisions Record (ADR)

## ADR-001: Hybrid Deployment Strategy

### Status: Implemented ✅

### Context
The Recipe Intelligence Platform needed to support both local development and production deployment while maintaining a consistent user experience.

### Decision
Implemented a hybrid deployment strategy using:
- **Local Development**: Express.js server (`server.js`) running on localhost:3000
- **Production**: Vercel Edge Functions (`api/chat.js`) for serverless deployment
- **Frontend**: Automatic environment detection and API endpoint switching

### Consequences
**Positive:**
- ✅ Seamless development experience with hot reloading
- ✅ Production-ready serverless deployment
- ✅ Cost-effective scaling with Vercel
- ✅ Consistent API interface across environments

**Trade-offs:**
- ⚠️ Code duplication between Express and Edge Function implementations
- ⚠️ Need to maintain two server implementations
- ⚠️ Different debugging approaches for each environment

## ADR-002: Database Choice - NeonDB over Firestore

### Status: Implemented ✅

### Context
The original PRD specified Firestore as the database, but the implementation chose NeonDB (PostgreSQL).

### Decision
Selected NeonDB (PostgreSQL) over Firestore for the following reasons:
- **SQL Familiarity**: Team expertise with PostgreSQL
- **Cost Efficiency**: More predictable pricing for small-scale usage
- **Flexibility**: Better support for complex queries and relationships
- **Local Development**: Easier local database setup and testing

### Consequences
**Positive:**
- ✅ Familiar SQL syntax and querying
- ✅ Better performance for complex queries
- ✅ More predictable costs
- ✅ Easier local development setup

**Trade-offs:**
- ⚠️ Deviates from original Google Cloud Platform vision
- ⚠️ May need migration strategy if scaling to Google Cloud
- ⚠️ Missing Firestore's real-time capabilities

## ADR-003: AI Integration - OpenRouter via n8n

### Status: Implemented ✅

### Context
The original PRD specified Vertex AI for LLM integration, but the implementation uses OpenRouter through n8n workflows.

### Decision
Chose OpenRouter + n8n approach because:
- **Cost Efficiency**: OpenRouter provides access to multiple AI models at competitive rates
- **Flexibility**: Easy model switching without code changes
- **Workflow Automation**: n8n provides visual workflow management
- **Rapid Prototyping**: Faster development cycle for AI features

### Consequences
**Positive:**
- ✅ Working conversational AI with Chef Marcus
- ✅ Cost-effective AI model access
- ✅ Visual workflow management with n8n
- ✅ Easy model switching and experimentation

**Trade-offs:**
- ⚠️ Deviates from original Google Cloud Platform vision
- ⚠️ Dependency on third-party AI service
- ⚠️ May need migration strategy for advanced AI features

## ADR-004: Frontend State Management - Zustand

### Status: Implemented ✅

### Context
The PRD specified Zustand for state management, which was implemented successfully.

### Decision
Zustand was chosen over Redux for:
- **Simplicity**: Minimal boilerplate code
- **TypeScript Support**: Excellent TypeScript integration
- **Bundle Size**: Smaller bundle size compared to Redux
- **Learning Curve**: Easier for small team to adopt

### Consequences
**Positive:**
- ✅ Clean, maintainable state management
- ✅ Excellent TypeScript support
- ✅ Minimal boilerplate code
- ✅ Good performance characteristics

**Trade-offs:**
- ⚠️ Smaller ecosystem compared to Redux
- ⚠️ Fewer middleware options
- ⚠️ Less community resources for complex patterns

## ADR-005: Chat Interface - HTTP Polling over WebSocket

### Status: Implemented ✅

### Context
The PRD specified WebSocket support for real-time chat, but the implementation uses HTTP polling.

### Decision
Implemented HTTP polling for chat because:
- **Simplicity**: Easier to implement and debug
- **Serverless Compatibility**: Works well with Vercel Edge Functions
- **Reliability**: More reliable than WebSocket connections
- **Development Speed**: Faster to implement for MVP

### Consequences
**Positive:**
- ✅ Working chat interface with Chef Marcus AI
- ✅ Compatible with serverless architecture
- ✅ Easier debugging and error handling
- ✅ Faster development cycle

**Trade-offs:**
- ⚠️ Higher latency compared to WebSocket
- ⚠️ More server requests
- ⚠️ May need WebSocket migration for better UX

## ADR-006: Authentication - JWT over Firebase Auth

### Status: Implemented ✅

### Context
The PRD specified Firebase Auth, but the implementation uses JWT-based authentication.

### Decision
Chose JWT authentication because:
- **Simplicity**: Easier to implement and understand
- **Database Integration**: Works well with NeonDB
- **Flexibility**: Custom user management and family accounts
- **Cost**: No additional Firebase costs

### Consequences
**Positive:**
- ✅ Simple, working authentication system
- ✅ Custom family account management
- ✅ No additional service dependencies
- ✅ Cost-effective solution

**Trade-offs:**
- ⚠️ Manual security implementation
- ⚠️ Missing Firebase Auth features (social login, etc.)
- ⚠️ Need to implement password reset, email verification

## ADR-007: File Storage - Local Storage over Cloud Storage

### Status: Implemented ✅

### Context
The PRD specified Cloud Storage for images and files, but the implementation uses local storage.

### Decision
Chose local storage because:
- **Development Speed**: Faster to implement for MVP
- **Cost**: No additional storage costs during development
- **Simplicity**: Easier to debug and test
- **Future Migration**: Can migrate to cloud storage later

### Consequences
**Positive:**
- ✅ Faster development cycle
- ✅ No additional costs during development
- ✅ Easy local testing and debugging
- ✅ Simple file handling

**Trade-offs:**
- ⚠️ Not scalable for production
- ⚠️ Files lost on server restart
- ⚠️ Need migration strategy for production

## Future Architecture Decisions

### ADR-008: Migration to Google Cloud Platform (Future)
**Status:** Planned 🔄

**Context:** As the platform scales, migration to Google Cloud Platform may be beneficial.

**Considerations:**
- **Vertex AI Integration**: For advanced AI features
- **Firestore Migration**: For real-time capabilities
- **Cloud Storage**: For scalable file storage
- **Cost Analysis**: Compare current vs. Google Cloud costs

### ADR-009: WebSocket Implementation (Future)
**Status:** Planned 🔄

**Context:** Real-time chat experience may require WebSocket implementation.

**Considerations:**
- **Performance**: Lower latency for chat
- **Complexity**: More complex implementation
- **Serverless Compatibility**: WebSocket support in Vercel
- **User Experience**: Real-time message delivery

### ADR-010: Vector Search Implementation (Future)
**Status:** Planned 🔄

**Context:** Advanced recipe discovery requires vector search capabilities.

**Considerations:**
- **Database Choice**: PostgreSQL with pgvector vs. dedicated vector database
- **Performance**: Search speed and accuracy
- **Cost**: Vector search infrastructure costs
- **Integration**: How to integrate with current architecture

## Conclusion

The current architecture successfully delivers the core value proposition (conversational AI chat interface) while maintaining flexibility for future enhancements. The hybrid deployment strategy and technology choices enable rapid development while keeping the door open for future migrations to more sophisticated cloud services.
