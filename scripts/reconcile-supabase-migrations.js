#!/usr/bin/env node

/**
 * Reconcile Supabase Migration History
 * 
 * This script:
 * 1. Renames migration files to Supabase CLI format (YYYYMMDDHHMMSS_description.sql)
 * 2. Creates a migration history reconciliation report
 * 3. Verifies migration structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const SUPABASE_MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

// Migration order with approximate dates (you can adjust these)
// Format: { filename, date: 'YYYYMMDD', time: 'HHMMSS', description }
const MIGRATION_ORDER = [
  { filename: '001_initial_schema.sql', date: '20240101', time: '000000', description: 'initial_schema' },
  { filename: '002_chat_messages.sql', date: '20240102', time: '000000', description: 'chat_messages' },
  { filename: '003_create_missing_tables.sql', date: '20240103', time: '000000', description: 'create_missing_tables' },
  { filename: '004_add_test_user.sql', date: '20240104', time: '000000', description: 'add_test_user' },
  { filename: '005_drop_chat_messages.sql', date: '20240105', time: '000000', description: 'drop_chat_messages' },
  { filename: '006_drop_unused_tables.sql', date: '20240106', time: '000000', description: 'drop_unused_tables' },
  { filename: '007_create_recipes_table.sql', date: '20240107', time: '000000', description: 'create_recipes_table' },
  { filename: '008_add_rag_support.sql', date: '20240108', time: '000000', description: 'add_rag_support' },
  { filename: '008_enable_rls_recipes.sql', date: '20240108', time: '000100', description: 'enable_rls_recipes' },
  { filename: '009_add_semantic_search_functions.sql', date: '20240109', time: '000000', description: 'add_semantic_search_functions' },
  { filename: '009_fix_rls_for_stack_auth.sql', date: '20240109', time: '000100', description: 'fix_rls_for_stack_auth' },
  { filename: '010_add_is_public_to_recipes.sql', date: '20240110', time: '000000', description: 'add_is_public_to_recipes' },
  { filename: '011_update_rls_for_public_recipes.sql', date: '20240111', time: '000000', description: 'update_rls_for_public_recipes' },
  { filename: '012_add_slug_to_recipes.sql', date: '20240112', time: '000000', description: 'add_slug_to_recipes' },
  { filename: '013_rename_users_to_profiles_add_first_last_name.sql', date: '20240113', time: '000000', description: 'rename_users_to_profiles' },
  { filename: '014_fix_profiles_table_schema.sql', date: '20240114', time: '000000', description: 'fix_profiles_table_schema' },
  { filename: '015_add_uuid_support_to_profiles.sql', date: '20240115', time: '000000', description: 'add_uuid_support_to_profiles' },
  { filename: '016_update_rls_for_supabase_auth.sql', date: '20250127', time: '000000', description: 'update_rls_for_supabase_auth' },
  { filename: '017_create_supabase_rpc_functions.sql', date: '20250127', time: '000100', description: 'create_supabase_rpc_functions' },
  { filename: '018_auto_create_profile_trigger.sql', date: '20250127', time: '000200', description: 'auto_create_profile_trigger' },
];

/**
 * Get current date in YYYYMMDD format
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Rename migration file to Supabase CLI format
 */
function renameMigration(oldPath, newName) {
  const newPath = path.join(SUPABASE_MIGRATIONS_DIR, newName);
  
  // Create supabase/migrations directory if it doesn't exist
  if (!fs.existsSync(SUPABASE_MIGRATIONS_DIR)) {
    fs.mkdirSync(SUPABASE_MIGRATIONS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${SUPABASE_MIGRATIONS_DIR}`);
  }
  
  // Copy file to new location with new name
  fs.copyFileSync(oldPath, newPath);
  console.log(`✅ Copied: ${path.basename(oldPath)} → ${newName}`);
  
  return newPath;
}

/**
 * Verify migration structure
 */
function verifyMigration(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for BEGIN/COMMIT
  if (!content.includes('BEGIN;') && !content.includes('BEGIN')) {
    issues.push('Missing BEGIN transaction');
  }
  
  if (!content.includes('COMMIT;') && !content.includes('COMMIT')) {
    issues.push('Missing COMMIT transaction');
  }
  
  // Check for dangerous operations
  if (content.includes('DROP TABLE') && !content.includes('IF EXISTS')) {
    issues.push('DROP TABLE without IF EXISTS (potentially dangerous)');
  }
  
  if (content.includes('DROP FUNCTION') && !content.includes('IF EXISTS')) {
    issues.push('DROP FUNCTION without IF EXISTS (potentially dangerous)');
  }
  
  return issues;
}

/**
 * Main reconciliation function
 */
function reconcileMigrations() {
  console.log('🔄 Reconciling Supabase Migration History...\n');
  
  // Ensure supabase/migrations directory exists
  if (!fs.existsSync(SUPABASE_MIGRATIONS_DIR)) {
    fs.mkdirSync(SUPABASE_MIGRATIONS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${SUPABASE_MIGRATIONS_DIR}\n`);
  }
  
  const migrationReport = {
    total: 0,
    renamed: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    migrations: []
  };
  
  // Process each migration
  for (const migration of MIGRATION_ORDER) {
    const oldPath = path.join(MIGRATIONS_DIR, migration.filename);
    
    if (!fs.existsSync(oldPath)) {
      console.log(`⚠️  Migration not found: ${migration.filename}`);
      migrationReport.warnings.push(`Migration not found: ${migration.filename}`);
      continue;
    }
    
    // Create new filename in Supabase CLI format
    const newName = `${migration.date}${migration.time}_${migration.description}.sql`;
    const newPath = path.join(SUPABASE_MIGRATIONS_DIR, newName);
    
    // Check if already exists
    if (fs.existsSync(newPath)) {
      console.log(`⏭️  Already exists: ${newName}`);
      migrationReport.skipped++;
      continue;
    }
    
    try {
      // Verify migration structure
      const issues = verifyMigration(oldPath);
      
      if (issues.length > 0) {
        console.log(`⚠️  ${migration.filename} has issues:`);
        issues.forEach(issue => console.log(`   - ${issue}`));
        migrationReport.warnings.push(`${migration.filename}: ${issues.join(', ')}`);
      }
      
      // Copy migration to supabase/migrations with new name
      fs.copyFileSync(oldPath, newPath);
      console.log(`✅ Renamed: ${migration.filename} → ${newName}`);
      
      migrationReport.renamed++;
      migrationReport.migrations.push({
        old: migration.filename,
        new: newName,
        date: migration.date,
        time: migration.time,
        issues: issues.length > 0 ? issues : null
      });
    } catch (error) {
      console.error(`❌ Error processing ${migration.filename}:`, error.message);
      migrationReport.errors.push(`${migration.filename}: ${error.message}`);
    }
    
    migrationReport.total++;
  }
  
  // Generate reconciliation report
  console.log('\n📊 Migration Reconciliation Report:');
  console.log(`   Total migrations: ${migrationReport.total}`);
  console.log(`   Renamed: ${migrationReport.renamed}`);
  console.log(`   Skipped: ${migrationReport.skipped}`);
  console.log(`   Errors: ${migrationReport.errors.length}`);
  console.log(`   Warnings: ${migrationReport.warnings.length}`);
  
  if (migrationReport.errors.length > 0) {
    console.log('\n❌ Errors:');
    migrationReport.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  if (migrationReport.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    migrationReport.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  // Save report to file
  const reportPath = path.join(__dirname, '..', 'supabase', 'migration_reconciliation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(migrationReport, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  // Generate SQL to check migration history
  console.log('\n📋 Next Steps:');
  console.log('1. Review the renamed migrations in supabase/migrations/');
  console.log('2. Check Supabase migration history:');
  console.log('   SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;');
  console.log('3. If migrations were already applied, mark them as applied:');
  console.log('   INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES');
  console.log('   (\'20240101000000\', \'initial_schema\'),');
  console.log('   ... (add all migration versions)');
  console.log('   ON CONFLICT (version) DO NOTHING;');
  console.log('4. Run: supabase db reset (to test all migrations)');
  console.log('5. Or run: supabase migration up (to apply new migrations)');
  
  return migrationReport;
}

// Run reconciliation
if (import.meta.url === `file://${process.argv[1]}`) {
  reconcileMigrations();
}

export { reconcileMigrations, verifyMigration };

