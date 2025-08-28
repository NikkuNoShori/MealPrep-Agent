import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

// Database connection using Neon serverless driver
const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_iugwGTjkF52J@ep-misty-snow-afo8dxhj-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

console.log('✅ Connected to Neon PostgreSQL database');

// Initialize database tables
export const initializeDatabase = async () => {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        family_id VARCHAR(255),
        household_size INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create recipes table
    await sql`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        ingredients JSONB,
        instructions JSONB,
        prep_time INTEGER,
        cook_time INTEGER,
        servings INTEGER,
        difficulty VARCHAR(50),
        tags TEXT[],
        image_url TEXT,
        rating DECIMAL(3,2),
        nutrition_info JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create chat_messages table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
        message_type VARCHAR(20) DEFAULT 'text',
        context JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create meal_plans table
    await sql`
      CREATE TABLE IF NOT EXISTS meal_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        meals JSONB,
        grocery_list JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create family_members table
    await sql`
      CREATE TABLE IF NOT EXISTS family_members (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        dietary_restrictions TEXT[],
        allergies TEXT[],
        preferences JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create receipts table
    await sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        store_info JSONB,
        raw_ocr_text TEXT,
        processed_items JSONB,
        total_amount DECIMAL(10,2),
        receipt_date DATE,
        processing_status VARCHAR(20) DEFAULT 'pending',
        user_corrections JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create user_preferences table
    await sql`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        global_restrictions TEXT[],
        cuisine_preferences TEXT[],
        cooking_skill_level VARCHAR(20),
        dietary_goals TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

// Helper function to run a query
export const query = (text, params) => {
  // Convert traditional query format to tagged template literal
  if (params && params.length > 0) {
    // This is a simplified conversion - for complex queries, use sql template literals directly
    return sql.unsafe(text, params);
  }
  return sql.unsafe(text);
};

export default sql;
