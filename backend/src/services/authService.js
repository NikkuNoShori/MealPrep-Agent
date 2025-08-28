import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 12;

export class AuthService {
  // Register a new user
  static async registerUser({ email, password, displayName }) {
    try {
      // Check if user already exists
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existingUser.length > 0) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Generate a unique UID
      const uid = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert new user
      const result = await sql`
        INSERT INTO users (uid, email, display_name, password_hash, family_id)
        VALUES (${uid}, ${email}, ${displayName}, ${passwordHash}, ${uid})
        RETURNING id, uid, email, display_name, family_id, household_size, created_at
      `;

      const user = result[0];

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          uid: user.uid, 
          email: user.email 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.display_name,
          familyId: user.family_id,
          householdSize: user.household_size
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Login user
  static async loginUser({ email, password }) {
    try {
      // Find user by email
      const result = await sql`
        SELECT id, uid, email, display_name, password_hash, family_id, household_size 
        FROM users WHERE email = ${email}
      `;

      if (result.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          uid: user.uid, 
          email: user.email 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.display_name,
          familyId: user.family_id,
          householdSize: user.household_size
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user by ID
  static async getUserById(userId) {
    try {
      const result = await sql`
        SELECT id, uid, email, display_name, family_id, household_size, created_at, updated_at
        FROM users WHERE id = ${userId}
      `;

      if (result.length === 0) {
        throw new Error('User not found');
      }

      const user = result[0];
      return {
        id: user.id,
        uid: user.uid,
        email: user.email,
        displayName: user.display_name,
        familyId: user.family_id,
        householdSize: user.household_size,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user by UID
  static async getUserByUid(uid) {
    try {
      const result = await sql`
        SELECT id, uid, email, display_name, family_id, household_size, created_at, updated_at
        FROM users WHERE uid = ${uid}
      `;

      if (result.length === 0) {
        throw new Error('User not found');
      }

      const user = result[0];
      return {
        id: user.id,
        uid: user.uid,
        email: user.email,
        displayName: user.display_name,
        familyId: user.family_id,
        householdSize: user.household_size,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  static async updateUser(userId, updates) {
    try {
      const allowedFields = ['display_name', 'household_size'];
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      // For dynamic updates, we'll use a simpler approach
      let updateQuery = 'UPDATE users SET ';
      const updateParts = [];
      
      if (updates.display_name) {
        updateParts.push(`display_name = '${updates.display_name}'`);
      }
      if (updates.household_size) {
        updateParts.push(`household_size = ${updates.household_size}`);
      }
      
      updateParts.push('updated_at = CURRENT_TIMESTAMP');
      updateQuery += updateParts.join(', ') + ` WHERE id = ${userId} RETURNING id, uid, email, display_name, family_id, household_size, created_at, updated_at`;
      
      const result = await sql.unsafe(updateQuery);

      if (result.length === 0) {
        throw new Error('User not found');
      }

      const user = result[0];
      return {
        id: user.id,
        uid: user.uid,
        email: user.email,
        displayName: user.display_name,
        familyId: user.family_id,
        householdSize: user.household_size,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Change password
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get current password hash
      const result = await sql`
        SELECT password_hash FROM users WHERE id = ${userId}
      `;

      if (result.length === 0) {
        throw new Error('User not found');
      }

      const user = result[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update password
      await sql`
        UPDATE users SET password_hash = ${newPasswordHash}, updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}
      `;

      return { message: 'Password updated successfully' };
    } catch (error) {
      throw error;
    }
  }
}
