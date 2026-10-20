// scripts/create-admin.js
// Creates the studio owner's portal account and grants it admin access.
//
// Two things happen, and both are required for the portal to open:
//   1. A Supabase Auth user is created (the login credentials).
//   2. Its ID is inserted into private.admin_users, which is what the
//      is_admin() function checks.
//
// The script is idempotent: running it again updates the password of an
// existing account rather than failing.
//
// Credentials come from the environment — never from this file (AGENTS 8.1).
// Put them in a local `.env`:
//   ADMIN_EMAIL=...   ADMIN_PASSWORD=...   SUPABASE_SECRET_KEY=...
//
//   node scripts/create-admin.js

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

/**
 * Creates the Auth user through the Supabase Admin API.
 * @param {string} url - The Supabase project URL.
 * @param {string} secretKey - The project secret key.
 * @param {string} email - The account email.
 * @param {string} password - The account password.
 * @returns {Promise<{id: string, created: boolean}>} The user id.
 */
async function upsertAuthUser(url, secretKey, email, password) {
  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json'
  };

  const listResp = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, { headers });
  if (!listResp.ok) throw new Error(`Auth user list failed: ${listResp.status}`);
  const listBody = await listResp.json();
  const existing = (listBody.users || []).find(u => u.email === email);

  if (existing) {
    const updateResp = await fetch(`${url}/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password, email_confirm: true })
    });
    if (!updateResp.ok) {
      throw new Error(`Auth password update failed: ${updateResp.status} ${await updateResp.text()}`);
    }
    return { id: existing.id, created: false };
  }

  const createResp = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  if (!createResp.ok) {
    throw new Error(`Auth user creation failed: ${createResp.status} ${await createResp.text()}`);
  }
  const created = await createResp.json();
  return { id: created.id, created: true };
}

async function run() {
  const url = readEnv('SUPABASE_URL');
  const secretKey = readEnv('SUPABASE_SECRET_KEY');
  const email = readEnv('ADMIN_EMAIL');
  const password = readEnv('ADMIN_PASSWORD');
  const connectionString = readEnv('DATABASE_URL') || readEnv('SUPABASE_DB_URL');

  const missing = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!secretKey) missing.push('SUPABASE_SECRET_KEY');
  if (!email) missing.push('ADMIN_EMAIL');
  if (!password) missing.push('ADMIN_PASSWORD');
  if (!connectionString) missing.push('DATABASE_URL');

  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    console.error('Add them to a local .env file. See .env.example for the names.');
    process.exitCode = 1;
    return;
  }

  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters (API.md AUTH-5).');
    process.exitCode = 1;
    return;
  }

  const { id, created } = await upsertAuthUser(url, secretKey, email, password);
  console.log(`${created ? 'Created' : 'Updated'} Auth user for ${email} (${id}).`);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO private.admin_users (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET created_at = now()`,
      [id]
    );
    console.log('private.admin_users row written — the portal will accept this account.');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Error creating the admin account:', err.message);
  process.exitCode = 1;
});
