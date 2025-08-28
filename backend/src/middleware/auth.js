import jwt from 'jsonwebtoken';
import { admin } from '../services/firebase.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists in Firebase
    const userRecord = await admin.auth().getUser(decoded.uid);
    
    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    req.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const generateToken = (uid) => {
  return jwt.sign({ uid }, process.env.JWT_SECRET, { expiresIn: '7d' });
};
