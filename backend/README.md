# MealPrep Agent - Backend API

The backend API for the Recipe Intelligence Platform, built with Node.js, Express, and Google Cloud services.

## 🚀 Features

- **Authentication**: JWT-based authentication with Firebase Auth
- **Recipe Management**: CRUD operations with AI-powered parsing
- **Conversational AI**: Chat interface with Vertex AI integration
- **Meal Planning**: Intelligent meal suggestions based on preferences
- **Receipt Processing**: OCR and item recognition pipeline
- **Real-time Chat**: WebSocket support for live chat
- **Vector Search**: Recipe discovery with embeddings

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Firestore (Google Cloud)
- **AI/ML**: Vertex AI (Gemini Pro, Text Embeddings)
- **Authentication**: Firebase Auth + JWT
- **Real-time**: Socket.io
- **Storage**: Google Cloud Storage
- **Deployment**: Google App Engine

## 📦 Installation

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Set up Google Cloud credentials**
   ```bash
   # Option 1: Service account key
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
   
   # Option 2: gcloud CLI
   gcloud auth application-default login
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_STORAGE_BUCKET=your-storage-bucket

# Firebase Configuration
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Vertex AI Configuration
VERTEX_AI_MODEL=gemini-pro
VERTEX_AI_EMBEDDING_MODEL=textembedding-gecko@001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Google Cloud Setup

1. **Create a Google Cloud Project**
   ```bash
   gcloud projects create mealprep-agent-[YOUR_ID]
   gcloud config set project mealprep-agent-[YOUR_ID]
   ```

2. **Enable required APIs**
   ```bash
   gcloud services enable firestore.googleapis.com
   gcloud services enable aiplatform.googleapis.com
   gcloud services enable storage.googleapis.com
   gcloud services enable vision.googleapis.com
   ```

3. **Create Firestore Database**
   ```bash
   gcloud firestore databases create --region=us-central1
   ```

4. **Set up service account**
   ```bash
   gcloud iam service-accounts create mealprep-agent-sa \
     --display-name="MealPrep Agent Service Account"
   
   gcloud projects add-iam-policy-binding mealprep-agent-[YOUR_ID] \
     --member="serviceAccount:mealprep-agent-sa@mealprep-agent-[YOUR_ID].iam.gserviceaccount.com" \
     --role="roles/datastore.user"
   
   gcloud projects add-iam-policy-binding mealprep-agent-[YOUR_ID] \
     --member="serviceAccount:mealprep-agent-sa@mealprep-agent-[YOUR_ID].iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   gcloud iam service-accounts keys create service-account-key.json \
     --iam-account=mealprep-agent-sa@mealprep-agent-[YOUR_ID].iam.gserviceaccount.com
   ```

## 🏗️ API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Recipes
- `GET /api/recipes` - Get user's recipes
- `GET /api/recipes/:id` - Get single recipe
- `POST /api/recipes` - Create new recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe
- `GET /api/recipes/search/:query` - Search recipes

### Chat
- `POST /api/chat/message` - Send chat message
- `POST /api/chat/add-recipe` - Add recipe via chat
- `GET /api/chat/history` - Get chat history
- `DELETE /api/chat/history` - Clear chat history

### Meal Planning
- `GET /api/meal-plans` - Get meal plans
- `POST /api/meal-plans` - Create meal plan

### Receipts
- `GET /api/receipts` - Get receipts
- `POST /api/receipts/upload` - Upload receipt

### Preferences
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update preferences

## 🔌 WebSocket Events

### Client to Server
- `join-chat` - Join user's chat room
- `send-message` - Send chat message

### Server to Client
- `message-received` - Receive AI response
- `error` - Error notification

## 🚀 Deployment

### Google App Engine

1. **Deploy to App Engine**
   ```bash
   gcloud app deploy
   ```

2. **Set environment variables**
   ```bash
   gcloud app deploy --set-env-vars NODE_ENV=production
   ```

### Docker (Alternative)

1. **Build Docker image**
   ```bash
   docker build -t mealprep-agent-backend .
   ```

2. **Run container**
   ```bash
   docker run -p 3001:3001 mealprep-agent-backend
   ```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 📊 Monitoring

### Health Check
- `GET /health` - Server health status

### Logging
- Application logs are sent to Google Cloud Logging
- Error tracking with structured logging

### Metrics
- Request/response times
- Error rates
- API usage statistics

## 🔒 Security

- **Authentication**: JWT tokens with Firebase Auth
- **Authorization**: User-based access control
- **Rate Limiting**: Configurable request limits
- **CORS**: Cross-origin resource sharing
- **Helmet**: Security headers
- **Input Validation**: Request sanitization

## 🔄 Development Workflow

1. **Local Development**
   ```bash
   npm run dev
   ```

2. **Testing**
   ```bash
   npm test
   ```

3. **Linting**
   ```bash
   npm run lint
   ```

4. **Deployment**
   ```bash
   npm run deploy
   ```

## 📝 API Documentation

### Request/Response Examples

#### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "displayName": "John Doe"
  }'
```

#### Create Recipe
```bash
curl -X POST http://localhost:3001/api/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Chicken Pasta",
    "ingredients": [
      {
        "name": "chicken breast",
        "amount": 2,
        "unit": "pieces",
        "category": "meat"
      }
    ],
    "instructions": ["Cook chicken", "Boil pasta"],
    "servings": 4,
    "prepTime": 15,
    "cookTime": 30,
    "difficulty": "easy"
  }'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
