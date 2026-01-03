/**
 * Update .env file with Local Supabase credentials
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverEnvPath = join(__dirname, '..', '.env');
const rootEnvPath = join(__dirname, '..', '..', '.env');

// Local Supabase credentials
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  Updating Environment Files with Local Supabase Creds   ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Update server/.env
let serverEnvContent = '';
if (existsSync(serverEnvPath)) {
  serverEnvContent = readFileSync(serverEnvPath, 'utf-8');
  console.log('📝 Found existing server/.env file');
} else {
  console.log('📝 Creating new server/.env file');
}

// Update or add Supabase credentials
if (serverEnvContent.includes('SUPABASE_URL=')) {
  serverEnvContent = serverEnvContent.replace(
    /SUPABASE_URL=.*/,
    `SUPABASE_URL=${SUPABASE_URL}`
  );
} else {
  serverEnvContent += `\nSUPABASE_URL=${SUPABASE_URL}\n`;
}

if (serverEnvContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
  serverEnvContent = serverEnvContent.replace(
    /SUPABASE_SERVICE_ROLE_KEY=.*/,
    `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}`
  );
} else {
  serverEnvContent += `SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}\n`;
}

// Ensure other required fields exist
if (!serverEnvContent.includes('PORT=')) {
  serverEnvContent += 'PORT=3001\n';
}
if (!serverEnvContent.includes('FRONTEND_URL=')) {
  serverEnvContent += 'FRONTEND_URL=http://localhost:8080\n';
}
if (!serverEnvContent.includes('NODE_ENV=')) {
  serverEnvContent += 'NODE_ENV=development\n';
}

writeFileSync(serverEnvPath, serverEnvContent.trim() + '\n');
console.log('✅ Updated server/.env with LOCAL Supabase credentials');

// Create/Update root .env for frontend
let rootEnvContent = '';
if (existsSync(rootEnvPath)) {
  rootEnvContent = readFileSync(rootEnvPath, 'utf-8');
  console.log('📝 Found existing root .env file');
} else {
  console.log('📝 Creating new root .env file');
}

// Update or add frontend Supabase credentials
if (rootEnvContent.includes('VITE_SUPABASE_URL=')) {
  rootEnvContent = rootEnvContent.replace(
    /VITE_SUPABASE_URL=.*/,
    `VITE_SUPABASE_URL=${SUPABASE_URL}`
  );
} else {
  rootEnvContent += `VITE_SUPABASE_URL=${SUPABASE_URL}\n`;
}

if (rootEnvContent.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
  rootEnvContent = rootEnvContent.replace(
    /VITE_SUPABASE_PUBLISHABLE_KEY=.*/,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}`
  );
} else {
  rootEnvContent += `VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}\n`;
}

writeFileSync(rootEnvPath, rootEnvContent.trim() + '\n');
console.log('✅ Updated root .env with LOCAL Supabase credentials');

console.log('\n✅ Environment files updated for LOCAL Supabase!\n');
console.log('Local Supabase Details:');
console.log(`  API URL: ${SUPABASE_URL}`);
console.log(`  Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres`);
console.log(`  Studio: http://127.0.0.1:54323\n`);
console.log('Next steps:');
console.log('1. Apply migrations: supabase db reset (or run migration SQL)');
console.log('2. Verify: cd server && node scripts/check-env.js');
console.log('3. Create admin: node scripts/createAdmin.js admin@mtu.edu.ng Admin123! "Admin User"\n');

























