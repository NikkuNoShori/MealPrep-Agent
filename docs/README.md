# MealPrep Agent Documentation

## 📁 Documentation Structure

This folder contains organized documentation for the MealPrep Agent project, sorted into logical categories. Outdated documentation has been moved to the `Archived/` subfolder.

## 🏗️ **Architecture/** - System Design & Architecture
- **`PRD.md`** - Product Requirements Document
- **`SDD.md`** - System Design Document  
- **`RAG_ARCHITECTURE_DESIGN.md`** - RAG system architecture design
- **`RAG_IMPLEMENTATION_GUIDE.md`** - Step-by-step RAG implementation guide
- **`RAG_SYSTEM_SUMMARY.md`** - Complete RAG system summary and benefits

## 🛠️ **Development/** - Setup & Configuration
- **`LOCAL_DEVELOPMENT.md`** - Local development setup guide
- **`EDGE_FUNCTION_README.md`** - Edge function documentation
- **`n8n-config.md`** - Current n8n workflow configuration
- **`n8n-rag-config.md`** - n8n configuration with RAG support

## ⭐ **Features/** - Feature-Specific Documentation
- **`CHAT_SESSION_MANAGEMENT.md`** - Chat session management implementation
- **`TEMPORARY_SESSION_SYSTEM.md`** - Temporary session system documentation
- **`ENHANCED_SYSTEM_PROMPT.md`** - AI system prompt for Chef Marcus
- **`THEME.md`** - Theme system documentation

## 🗄️ **Database/** - Database & Migrations
- **`CLEAN_MIGRATION_FILES.md`** - Clean SQL migration files for Neon compatibility

## 📦 Archived Documentation

The `Archived/` folder contains outdated documentation that explains previous architecture decisions and implementation status:

- **`ARCHITECTURE_DECISIONS.md`** - Previous architecture decisions (pre-RAG)
- **`IMPLEMENTATION_STATUS.md`** - Outdated implementation status
- **`CHECKLIST.md`** - Outdated implementation checklist
- **`FRONTEND_CHECKLIST.md`** - Outdated frontend checklist
- **`PRIORITY_ASSESSMENT.md`** - Outdated priority assessment
- **`DEPLOYMENT_GUIDE.md`** - Outdated deployment guide

## 🎯 **Key Features Implemented**

### ✅ **RAG-Enhanced Chat System**
- Natural text to recipe conversion
- Vector-based recipe search
- Database-aware intelligent responses
- Temporary session management

### ✅ **Recipe Management**
- Structured recipe storage in PostgreSQL
- Vector embeddings for semantic search
- Recipe categories and tagging system
- Full-text and semantic search capabilities

### ✅ **Session Management**
- Temporary sessions for unused chats
- Persistent sessions for active conversations
- Multi-select chat deletion
- Automatic cleanup of unused sessions

## 🚀 **Getting Started**

1. **Database Setup**: See `Database/CLEAN_MIGRATION_FILES.md` for database setup
2. **RAG Implementation**: Follow `Architecture/RAG_IMPLEMENTATION_GUIDE.md`
3. **Local Development**: Use `Development/LOCAL_DEVELOPMENT.md` for setup
4. **n8n Configuration**: Import `Development/n8n-rag-config.md` for AI workflows

## 📈 **Architecture Evolution**

The project has evolved from a basic chat interface to a sophisticated RAG-enhanced system:

- **Phase 1**: Basic chat interface with n8n integration
- **Phase 2**: Recipe extraction and storage
- **Phase 3**: RAG system with vector search (current)
- **Phase 4**: Advanced session management (current)

## 🔧 **Current Tech Stack**

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Express.js + Vercel Edge Functions
- **Database**: PostgreSQL (Neon) with vector extensions
- **AI**: OpenRouter via n8n workflows
- **Search**: Vector similarity + full-text search
- **Deployment**: Vercel for production

## 📝 **Documentation Guidelines**

- **Architecture docs**: System design, requirements, and RAG documentation
- **Development docs**: Setup guides, configuration, and deployment
- **Feature docs**: Specific feature implementations and user-facing functionality
- **Database docs**: Migration files and database-related documentation
- **Outdated docs**: Move to `Archived/` folder
- **New features**: Create documentation in appropriate subfolder
- **Updates**: Update existing docs when architecture changes

---

*Last updated: September 2024*
