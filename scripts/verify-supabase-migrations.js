#!/usr/bin/env node

/**
 * Verify Supabase Migration Structure
 * 
 * This script verifies that all migrations:
 * 1. Have proper BEGIN/COMMIT transactions
 * 2. Use IF EXISTS for DROP statements
 * 3. Are properly formatted
 * 4. Don't have syntax errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const SUPABASE_MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

/**
 * Verify a single migration file
 */
function verifyMigration(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  const issues = [];
  const warnings = [];
  
  // Check for BEGIN/COMMIT
  const hasBegin = content.includes('BEGIN;') || content.includes('BEGIN');
  const hasCommit = content.includes('COMMIT;') || content.includes('COMMIT');
  
  if (!hasBegin) {
    warnings.push('Missing BEGIN transaction (recommended for migrations)');
  }
  
  if (!hasCommit) {
    warnings.push('Missing COMMIT transaction (recommended for migrations)');
  }
  
  // Check for dangerous operations
  const dropTableMatches = content.match(/DROP\s+TABLE\s+(\w+)/gi);
  if (dropTableMatches) {
    dropTableMatches.forEach(match => {
      if (!match.includes('IF EXISTS')) {
        issues.push(`DROP TABLE without IF EXISTS: ${match}`);
      }
    });
  }
  
  const dropFunctionMatches = content.match(/DROP\s+FUNCTION\s+(\w+)/gi);
  if (dropFunctionMatches) {
    dropFunctionMatches.forEach(match => {
      if (!match.includes('IF EXISTS')) {
        issues.push(`DROP FUNCTION without IF EXISTS: ${match}`);
      }
    });
  }
  
  const dropPolicyMatches = content.match(/DROP\s+POLICY\s+(\w+)/gi);
  if (dropPolicyMatches) {
    dropPolicyMatches.forEach(match => {
      if (!match.includes('IF EXISTS')) {
        warnings.push(`DROP POLICY without IF EXISTS: ${match} (may fail if policy doesn't exist)`);
      }
    });
  }
  
  // Check for CREATE OR REPLACE (good practice)
  const createMatches = content.match(/CREATE\s+(TABLE|FUNCTION|POLICY)\s+(\w+)/gi);
  if (createMatches && !content.includes('CREATE OR REPLACE') && !content.includes('IF NOT EXISTS')) {
    warnings.push('Consider using CREATE OR REPLACE or IF NOT EXISTS for idempotency');
  }
  
  // Check for semicolons (basic syntax check)
  const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('--'));
  const statementsWithoutSemicolon = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed && 
           !trimmed.endsWith(';') && 
           !trimmed.startsWith('--') &&
           !trimmed.match(/^(BEGIN|COMMIT|END|IF|ELSE|ELSIF|END IF)$/i);
  });
  
  if (statementsWithoutSemicolon.length > 0) {
    warnings.push(`Some statements may be missing semicolons (${statementsWithoutSemicolon.length} lines)`);
  }
  
  return {
    filename,
    path: filePath,
    issues,
    warnings,
    hasBegin,
    hasCommit,
    lineCount: content.split('\n').length
  };
}

/**
 * Verify all migrations
 */
function verifyAllMigrations() {
  console.log('🔍 Verifying Supabase Migrations...\n');
  
  const migrationsDir = fs.existsSync(SUPABASE_MIGRATIONS_DIR) 
    ? SUPABASE_MIGRATIONS_DIR 
    : MIGRATIONS_DIR;
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    return;
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (files.length === 0) {
    console.log(`⚠️  No migration files found in ${migrationsDir}`);
    return;
  }
  
  console.log(`Found ${files.length} migration files\n`);
  
  const results = [];
  let totalIssues = 0;
  let totalWarnings = 0;
  
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const result = verifyMigration(filePath);
    results.push(result);
    
    totalIssues += result.issues.length;
    totalWarnings += result.warnings.length;
    
    if (result.issues.length > 0 || result.warnings.length > 0) {
      console.log(`📄 ${file}:`);
      
      if (result.issues.length > 0) {
        console.log('   ❌ Issues:');
        result.issues.forEach(issue => console.log(`      - ${issue}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('   ⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`      - ${warning}`));
      }
      
      console.log('');
    } else {
      console.log(`✅ ${file} - OK`);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Total migrations: ${files.length}`);
  console.log(`   Total issues: ${totalIssues}`);
  console.log(`   Total warnings: ${totalWarnings}`);
  
  if (totalIssues === 0 && totalWarnings === 0) {
    console.log('\n✅ All migrations are properly formatted!');
  } else if (totalIssues === 0) {
    console.log('\n⚠️  Some migrations have warnings but no critical issues.');
  } else {
    console.log('\n❌ Some migrations have issues that should be fixed.');
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'supabase', 'migration_verification_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  return results;
}

// Run verification
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyAllMigrations();
}

export { verifyAllMigrations, verifyMigration };

