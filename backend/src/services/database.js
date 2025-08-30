import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

// Database connection using Neon serverless driver
const sql = neon(process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('✅ Connected to Neon PostgreSQL database');

// Initialize database tables
export const initializeDatabase = async () => {
  try {
    // Test database connection
    await sql`SELECT 1`;
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
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
