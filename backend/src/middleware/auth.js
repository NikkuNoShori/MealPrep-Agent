import { AuthService } from '../services/authService.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify JWT token
    const decoded = AuthService.verifyToken(token);
    
    // Get user from database
    const user = await AuthService.getUserById(decoded.userId);
    
    req.user = {
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      familyId: user.familyId,
      householdSize: user.householdSize
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
  return AuthService.generateToken(uid);
};
