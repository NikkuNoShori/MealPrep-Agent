# MealPrep Agent - Recipe Intelligence Platform

An AI-powered meal planning and recipe management system designed for families. The platform combines conversational AI, automated grocery planning, and personalized recipe recommendations to transform how families discover, manage, and plan meals.

## 🚀 Features

- **Conversational Recipe Management**: Add and manage recipes through natural conversation
- **Family Preference Engine**: AI that learns individual and household food preferences
- **Intelligent Meal Planning**: Automated meal suggestions with variety optimization
- **Receipt & Purchase Integration**: OCR processing of grocery receipts
- **Recipe Scaling & Household Management**: Dynamic recipe adjustment based on household size

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vite + React with TypeScript
- **State Management**: Zustand
- **Styling**: Tailwind CSS with dark theme support
- **Routing**: React Router
- **Forms**: React Hook Form
- **API Layer**: React Query
- **Icons**: Lucide React

### Backend (Planned)
- **Cloud Platform**: Google Cloud Platform
- **AI/ML**: Vertex AI for LLM and embedding models
- **Database**: Firestore for recipe storage, Vector Search for RAG
- **API**: Cloud Functions for serverless endpoints
- **Processing**: Cloud Run for agent services
- **Storage**: Cloud Storage for images and files
- **Automation**: N8N for workflow orchestration

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MealPrep-Agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 🏗️ Project Structure

```
src/
├── components/
│   ├── chat/           # Chat interface components
│   ├── recipes/        # Recipe management components
│   ├── common/         # Shared components (Layout, Header)
│   └── ui/             # Reusable UI components
├── contexts/           # React contexts (Theme)
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API and external service integrations
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## 🎨 Design System

The application uses a custom design system built with Tailwind CSS:

- **Colors**: Primary (blue) and Secondary (purple) color schemes
- **Typography**: Inter font family
- **Components**: Card, Button, Input, and other reusable components
- **Dark Mode**: Full dark theme support with system preference detection

## 📱 Pages

- **Landing Page** (`/`): Marketing page with feature overview
- **Dashboard** (`/dashboard`): Main application dashboard
- **Chat** (`/chat`): Conversational AI interface
- **Recipes** (`/recipes`): Recipe management
- **Meal Planner** (`/meal-planner`): Meal planning interface

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=your_api_url_here
VITE_WEBSOCKET_URL=your_websocket_url_here
```

## 🚧 Current Status

### Frontend (Complete)
- ✅ Vite + React + TypeScript configuration
- ✅ Tailwind CSS with custom design system
- ✅ React Router for navigation
- ✅ Theme context with dark mode support
- ✅ Landing page with modern design
- ✅ Placeholder pages for main features
- ✅ TypeScript type definitions
- ✅ Responsive layout and components
- ✅ API service layer with React Query

### Backend (Complete)
- ✅ Express.js server with middleware
- ✅ Firebase Admin SDK integration
- ✅ Vertex AI service for LLM and embeddings
- ✅ JWT authentication with Firebase Auth
- ✅ WebSocket support for real-time chat
- ✅ Complete API routes for all features
- ✅ Error handling and validation
- ✅ Google App Engine deployment config

### Next Steps

1. **Google Cloud Setup**: Configure project and enable APIs
2. **Environment Configuration**: Set up environment variables
3. **Frontend Integration**: Connect frontend to backend APIs
4. **Chat Interface**: Build conversational AI components
5. **Recipe Management**: Implement CRUD operations
6. **Meal Planning**: Build intelligent meal suggestions
7. **Receipt Processing**: Integrate OCR pipeline
8. **Testing & Deployment**: Comprehensive testing and production deployment

## 📄 Documentation

- [Product Requirements Document](./docs/PRD.md)
- [System Design Document](./docs/SDD.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide React](https://lucide.dev/)
- State management with [Zustand](https://github.com/pmndrs/zustand)
