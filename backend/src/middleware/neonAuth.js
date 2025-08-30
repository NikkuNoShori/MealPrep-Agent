import { NeonAuthService } from '../services/neonAuth.js';

export const authenticateNeonUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // TODO: Verify NeonDB JWT token
    // For now, we'll use a placeholder that expects a neon_user_id in the token
    // In production, you'll verify the JWT with NeonDB's public keys
    
    // Extract neon_user_id from token (this is a simplified approach)
    // In reality, you'd verify the JWT signature with NeonDB's public keys
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const neonUserId = decoded.sub; // NeonDB user ID

    if (!neonUserId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get or create user from database
    const user = await NeonAuthService.getUserByNeonId(neonUserId);
    
    req.user = {
      id: user.id,
      neonUserId: user.neon_user_id,
      email: user.email,
      displayName: user.display_name,
      familyId: user.family_id,
      householdSize: user.household_size
    };

    next();
  } catch (error) {
    console.error('NeonDB authentication error:', error);
    
    if (error.message === 'User not found') {
      return res.status(401).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional authentication for public endpoints
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const neonUserId = decoded.sub;

      if (neonUserId) {
        const user = await NeonAuthService.getUserByNeonId(neonUserId);
        req.user = {
          id: user.id,
          neonUserId: user.neon_user_id,
          email: user.email,
          displayName: user.display_name,
          familyId: user.family_id,
          householdSize: user.household_size
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
