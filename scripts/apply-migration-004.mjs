/**
 * scripts/apply-migration-004.mjs
 * Applies migration 004 (add media support) via the DATABASE_URL
 * PostgreSQL connection (same approach as db:setup).
 * Run: node scripts/apply-migration-004.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readEnv(name) {
  if (process.env[name]) return process.env[name].trim();
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return '';
  const line = readFileSync(envPath, 'utf8').split('\n').find(l => l.trim().startsWith(`${name}=`));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

const DATABASE_URL = readEnv('DATABASE_URL');
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL must be set in .env');
  process.exit(1);
}

const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20261020000004_add_media_support.sql');
const sql = readFileSync(migrationPath, 'utf8');

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('Connected to database. Applying migration 004…\n');

  // Split on semicolons, run each statement
  const statements = sql
    .split(';')
    .map(s => s.replace(/--[^\n]*/g, '').trim())
    .filter(s => s.length > 5);

  for (const stmt of statements) {
    const label = stmt.slice(0, 70).replace(/\s+/g, ' ').trim();
    try {
      await client.query(stmt);
      console.log(`✓ ${label}…`);
    } catch (e) {
      // Column/index already exists is fine
      if (e.message.includes('already exists')) {
        console.log(`  (already exists) ${label}…`);
      } else {
        console.error(`  ✗ FAILED: ${label}…\n    ${e.message}`);
      }
    }
  }

  console.log('\n✓ Migration 004 complete.');
} catch (e) {
  console.error('Connection error:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
