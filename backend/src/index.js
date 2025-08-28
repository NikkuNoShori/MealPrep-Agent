import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.js';
import recipeRoutes from './routes/recipes.js';
import chatRoutes from './routes/chat.js';
import mealPlanRoutes from './routes/mealPlans.js';
import receiptRoutes from './routes/receipts.js';
import preferenceRoutes from './routes/preferences.js';

// Import middleware
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import services
import { initializeFirebase } from './services/firebase.js';
import { initializeDatabase } from './services/database.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', authenticateToken, recipeRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/meal-plans', authenticateToken, mealPlanRoutes);
app.use('/api/receipts', authenticateToken, receiptRoutes);
app.use('/api/preferences', authenticateToken, preferenceRoutes);

// WebSocket connection for chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-chat', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined chat room`);
  });
  
  socket.on('send-message', async (data) => {
    try {
      // Handle chat message processing here
      const { userId, message } = data;
      
      // Emit back to the user
      socket.emit('message-received', {
        id: Date.now().toString(),
        content: `Processing: ${message}`,
        sender: 'ai',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize services
const initializeServices = async () => {
  try {
    await initializeDatabase();
    await initializeFirebase();
    console.log('✅ Services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 3001;
const startServer = async () => {
  await initializeServices();
  
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
};

startServer().catch(console.error);

export { io };
