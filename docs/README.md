# MealPrep Agent Documentation

## 📁 Documentation Structure

This folder contains organized documentation for the MealPrep Agent project.

## 🏗️ **Architecture/** - System Design & Architecture

- **`ARCHITECTURE_SUMMARY.md`** - Complete architecture overview and system design
- **`PRD.md`** - Product Requirements Document
- **`SDD.md`** - System Design Document
- **`RAG.md`** - RAG system architecture and implementation
- **`SECURITY.md`** - Security and performance implementation status
- **`USER_AUTHENTICATION_ARCHITECTURE.md`** - Authentication and profile architecture
- **`PROFILE_CREATION_FLOW.md`** - Profile creation flow documentation
- **`ENV_LOADING_OPTIMIZATION.md`** - Environment variable loading optimization
- **`diagrams.md`** - Mermaid diagrams for architecture visualization
- **`n8n-config.md`** - n8n workflow configuration

## 🛠️ **Development/** - Setup & Configuration

- **`LOCAL_DEVELOPMENT.md`** - Local development setup guide
- **`RAG_SEARCH_EDGE_FUNCTION.md`** - RAG search edge function deployment and usage
- **`N8N_RAG_SEARCH_CONFIGURATION.md`** - n8n RAG search configuration
- **`N8N_URL_OPTIONS.md`** - n8n URL configuration options
- **`DEPLOY_TO_N8N_SERVER.md`** - Deployment guide for n8n server
- **`EDGE_FUNCTION_README.md`** - Edge function documentation
- **`FIXES_TRACKER.md`** - Bug fixes and issue tracking
- **`n8n-rag-config.md`** - n8n configuration with RAG support
- **`n8n-rag-search-config.json`** - n8n RAG search configuration JSON

## ⭐ **core/** - Core System Documentation

- **`SERVER_LOGGING_GUIDE.md`** - Server logging configuration

## 📚 **Root Documentation** - Quick Reference Guides

- **`DATABASE_SETUP.md`** - Supabase database setup guide
- **`RLS_AND_OAUTH_SETUP.md`** - Row Level Security and OAuth setup
- **`SUPABASE_GOOGLE_OAUTH_SETUP.md`** - Supabase Google OAuth configuration guide
- **`GOOGLE_OAUTH_SETUP.md`** - General Google OAuth setup
- **`SUPABASE_CONNECTION_STRING.md`** - Supabase connection string guide
- **`CLEANUP_SUMMARY.md`** - Documentation cleanup summary

## 🗄️ **Archived/** - Historical Documentation

The `Archived/` folder contains outdated documentation that explains previous architecture decisions and implementation status:

- **`ARCHITECTURE_DECISIONS.md`** - Previous architecture decisions (pre-RAG)
- **`IMPLEMENTATION_STATUS.md`** - Outdated implementation status
- **`CHECKLIST.md`** - Outdated implementation checklist
- **`FRONTEND_CHECKLIST.md`** - Outdated frontend checklist
- **`PRIORITY_ASSESSMENT.md`** - Outdated priority assessment
- **`DEPLOYMENT_GUIDE.md`** - Outdated deployment guide

## 🎯 **Key Features**

### ✅ **RAG-Enhanced Chat System**
- Natural text to recipe conversion
- Vector-based recipe search
- Database-aware intelligent responses
- Context-aware AI responses

### ✅ **Recipe Management**
- Structured recipe storage in PostgreSQL
- Vector embeddings for semantic search
- Recipe categories and tagging system
- Full-text and semantic search capabilities
- SEO-friendly URLs with slugs

### ✅ **User Authentication**
- Supabase Auth (cookie-based sessions)
- Sign up, sign in, sign out
- Password reset and forgot password flows
- Session persistence across page refreshes
- Protected routes with automatic redirects

### ✅ **Security & Performance**
- Authentication middleware on all endpoints
- RLS policies for database-level security
- Rate limiting and input validation
- Security headers (Helmet.js)
- XSS protection and input sanitization
- Optimized connection pooling
- Query performance monitoring

## 🚀 **Getting Started**

1. **Database Setup**: See `DATABASE_SETUP.md` for Supabase configuration
2. **Local Development**: See `Development/LOCAL_DEVELOPMENT.md`
3. **Authentication**: See `SUPABASE_GOOGLE_OAUTH_SETUP.md` and `RLS_AND_OAUTH_SETUP.md`
4. **RLS Setup**: See `RLS_AND_OAUTH_SETUP.md` for Row Level Security configuration
5. **RAG Setup**: See `Architecture/RAG.md` and `Development/RAG_SEARCH_EDGE_FUNCTION.md`
6. **n8n Configuration**: Import `Development/n8n-rag-config.md` for AI workflows

## 📈 **Architecture Evolution**

The project has evolved from a basic chat interface to a sophisticated RAG-enhanced system:

- **Phase 1**: Basic chat interface with n8n integration
- **Phase 2**: Recipe extraction and storage
- **Phase 3**: RAG system with vector search (current)
- **Phase 4**: Security and performance improvements (current)

## 🔧 **Current Tech Stack**

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Express.js + Vercel Edge Functions
- **Database**: PostgreSQL (Supabase) with pgvector extension
- **AI**: OpenRouter via n8n workflows
- **Search**: Vector similarity + full-text search
- **Auth**: Supabase Auth (cookie-based sessions)
- **Deployment**: Vercel for production

## 📝 **Documentation Guidelines**

- **Architecture docs**: System design, requirements, and RAG documentation
- **Development docs**: Setup guides, configuration, and deployment
- **Core docs**: Core system features (auth, logging, etc.)
- **Outdated docs**: Move to `Archived/` folder
- **New features**: Create documentation in appropriate subfolder
- **Updates**: Update existing docs when architecture changes

---

*Last updated: November 2025*
