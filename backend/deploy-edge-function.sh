#!/bin/bash

# Deploy Chat Edge Function to Vercel
# This script helps deploy the chat edge function with proper configuration

set -e

echo "🚀 Deploying Chat Edge Function to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Please install it first:"
    echo "npm install -g vercel"
    exit 1
fi

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the backend directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one with your environment variables:"
    echo "DATABASE_URL=your_neon_database_url"
    echo "FRONTEND_URL=your_frontend_url"
    echo "VERTEX_AI_PROJECT_ID=your_vertex_ai_project_id"
    echo "VERTEX_AI_LOCATION=your_vertex_ai_location"
    exit 1
fi

# Create edge-functions directory if it doesn't exist
mkdir -p edge-functions

# Copy the chat edge function
cp src/edge-functions/chat.js edge-functions/chat.js

# Create vercel.json for edge function configuration
cat > vercel.json << EOF
{
  "functions": {
    "edge-functions/chat.js": {
      "runtime": "edge"
    }
  },
  "routes": [
    {
      "src": "/api/chat/(.*)",
      "dest": "/edge-functions/chat.js"
    }
  ]
}
EOF

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "🔗 Your edge function is now available at:"
echo "https://your-project.vercel.app/api/chat/*"
echo ""
echo "📝 Next steps:"
echo "1. Update your frontend API base URL to point to the Vercel deployment"
echo "2. Test the chat functionality"
echo "3. Monitor the edge function logs in Vercel dashboard"
