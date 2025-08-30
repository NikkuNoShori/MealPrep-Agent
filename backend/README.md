# Backend - Edge Functions

This folder contains the simplified edge function setup for the MealPrep Agent.

## 📁 **Structure**

```
backend/
├── edge-functions/
│   ├── chat-api.js          # Main edge function for API endpoints
│   └── vercel.json          # Vercel configuration
├── EDGE_FUNCTION_DEPLOYMENT.md  # Deployment guide
└── README.md               # This file
```

## 🚀 **What's Here**

- **Edge Function**: `chat-api.js` - Handles all API calls and webhooks
- **Database Migrations**: SQL files to set up your database tables
- **Deployment Guide**: Complete instructions for deploying to Vercel/Netlify

## 🎯 **Next Steps**

1. Run the database migrations in your NeonDB dashboard
2. Deploy the edge function (see `EDGE_FUNCTION_DEPLOYMENT.md`)
3. Update your frontend API URL to point to the deployed function

## ✅ **Benefits**

- No Express.js server to maintain
- Auto-scaling edge functions
- Simple deployment
- Lower costs
- Better performance
