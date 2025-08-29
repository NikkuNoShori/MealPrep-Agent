import sql from './database.js';

export class NeonAuthService {
  // Create or get user from Neon Auth
  static async createOrGetUser(neonUser) {
    try {
      const { id: neonUserId, email, user_metadata } = neonUser;
      
      // Check if user already exists
      let user = await sql`
        SELECT * FROM users WHERE neon_user_id = ${neonUserId}
      `;

      if (user.length > 0) {
        return user[0];
      }

      // Create new user
      const displayName = user_metadata?.full_name || email.split('@')[0];
      
      const result = await sql`
        INSERT INTO users (neon_user_id, email, display_name)
        VALUES (${neonUserId}, ${email}, ${displayName})
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      console.error('Error creating/getting user:', error);
      throw error;
    }
  }

  // Get user by Neon user ID
  static async getUserByNeonId(neonUserId) {
    try {
      const result = await sql`
        SELECT * FROM users WHERE neon_user_id = ${neonUserId}
      `;

      if (result.length === 0) {
        throw new Error('User not found');
      }

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Get user by email
  static async getUserByEmail(email) {
    try {
      const result = await sql`
        SELECT * FROM users WHERE email = ${email}
      `;

      if (result.length === 0) {
        throw new Error('User not found');
      }

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  static async updateUserProfile(neonUserId, updates) {
    try {
      const allowedFields = ['display_name', 'household_size', 'avatar_url', 'timezone'];
      const updateFields = [];
      const values = [];

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${updateFields.length + 1}`);
          values.push(value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(neonUserId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')} 
        WHERE neon_user_id = $${values.length}
        RETURNING *
      `;

      const result = await sql.unsafe(query, values);

      if (result.length === 0) {
        throw new Error('User not found');
      }

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Get user with preferences
  static async getUserWithPreferences(neonUserId) {
    try {
      const result = await sql`
        SELECT 
          u.*,
          up.global_restrictions,
          up.cuisine_preferences,
          up.cooking_skill_level,
          up.dietary_goals,
          up.spice_tolerance,
          up.meal_prep_preference,
          up.budget_range,
          up.time_constraints
        FROM users u
        LEFT JOIN user_preferences up ON u.id = up.user_id
        WHERE u.neon_user_id = ${neonUserId}
      `;

      if (result.length === 0) {
        throw new Error('User not found');
      }

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Create or update user preferences
  static async upsertUserPreferences(neonUserId, preferences) {
    try {
      const user = await this.getUserByNeonId(neonUserId);
      
      const result = await sql`
        INSERT INTO user_preferences (
          user_id, 
          global_restrictions, 
          cuisine_preferences, 
          cooking_skill_level, 
          dietary_goals,
          spice_tolerance,
          meal_prep_preference,
          budget_range,
          time_constraints
        )
        VALUES (
          ${user.id},
          ${preferences.global_restrictions || []},
          ${preferences.cuisine_preferences || []},
          ${preferences.cooking_skill_level || 'intermediate'},
          ${preferences.dietary_goals || []},
          ${preferences.spice_tolerance || 'medium'},
          ${preferences.meal_prep_preference || 'moderate'},
          ${preferences.budget_range || 'medium'},
          ${preferences.time_constraints || {}}
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET
          global_restrictions = EXCLUDED.global_restrictions,
          cuisine_preferences = EXCLUDED.cuisine_preferences,
          cooking_skill_level = EXCLUDED.cooking_skill_level,
          dietary_goals = EXCLUDED.dietary_goals,
          spice_tolerance = EXCLUDED.spice_tolerance,
          meal_prep_preference = EXCLUDED.meal_prep_preference,
          budget_range = EXCLUDED.budget_range,
          time_constraints = EXCLUDED.time_constraints,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Get family members
  static async getFamilyMembers(neonUserId) {
    try {
      const user = await this.getUserByNeonId(neonUserId);
      
      const result = await sql`
        SELECT * FROM family_members 
        WHERE family_id = ${user.family_id}
        ORDER BY created_at ASC
      `;

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Add family member
  static async addFamilyMember(neonUserId, memberData) {
    try {
      const user = await this.getUserByNeonId(neonUserId);
      
      const result = await sql`
        INSERT INTO family_members (
          family_id,
          name,
          relationship,
          age,
          dietary_restrictions,
          allergies,
          preferences
        )
        VALUES (
          ${user.family_id},
          ${memberData.name},
          ${memberData.relationship || null},
          ${memberData.age || null},
          ${memberData.dietary_restrictions || []},
          ${memberData.allergies || []},
          ${memberData.preferences || {}}
        )
        RETURNING *
      `;

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Update family member
  static async updateFamilyMember(memberId, updates) {
    try {
      const allowedFields = ['name', 'relationship', 'age', 'dietary_restrictions', 'allergies', 'preferences', 'is_active'];
      const updateFields = [];
      const values = [];

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field)) {
          updateFields.push(`${field} = $${updateFields.length + 1}`);
          values.push(value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(memberId);

      const query = `
        UPDATE family_members 
        SET ${updateFields.join(', ')} 
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await sql.unsafe(query, values);

      if (result.length === 0) {
        throw new Error('Family member not found');
      }

      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Delete family member
  static async deleteFamilyMember(memberId) {
    try {
      const result = await sql`
        DELETE FROM family_members 
        WHERE id = ${memberId}
        RETURNING *
      `;

      if (result.length === 0) {
        throw new Error('Family member not found');
      }

      return result[0];
    } catch (error) {
      throw error;
    }
  }
}
