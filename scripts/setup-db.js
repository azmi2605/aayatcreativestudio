// scripts/setup-db.js
// Applies the database schema and seed data over a direct PostgreSQL connection.
//
// The connection string is read from the environment — never from this file
// (AGENTS 8.1). Put it in a local `.env` or export it before running.
//
//   set DATABASE_URL=postgresql://... && npm run db:setup

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_SCHEMA_FILE = join(__dirname, '..', 'supabase', 'SETUP_RUN_IN_SUPABASE.sql');

/**
 * Reads a variable from the environment, falling back to the local `.env` file.
 * @param {string} name - The variable name.
 * @returns {string} The value, or an empty string when it is not set.
 */
function readEnv(name) {
  if (process.env[name]) return process.env[name].trim();

  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return '';

  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find(l => l.trim().startsWith(`${name}=`));

  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

async function run() {
  const connectionString = readEnv('DATABASE_URL') || readEnv('SUPABASE_DB_URL');
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Add it to a local .env file and try again.');
    process.exitCode = 1;
    return;
  }

  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully.');

    const sqlPath = readEnv('SCHEMA_FILE') || DEFAULT_SCHEMA_FILE;
    const sql = readFileSync(sqlPath, 'utf8');

    console.log(`Executing ${sqlPath}...`);
    await client.query(sql);
    console.log('Schema migration executed successfully.');

    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\nPublic tables in database:');
    res.rows.forEach(r => console.log(' - ' + r.table_name));

    const countRes = await client.query('SELECT count(*) FROM public.portfolio_items;');
    console.log(`\nPortfolio items count: ${countRes.rows[0].count}`);

    console.log('\nDatabase setup complete.');
  } catch (err) {
    console.error('Error executing database setup:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

run();
