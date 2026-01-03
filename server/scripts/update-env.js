/**
 * Update .env file with Supabase credentials
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverEnvPath = join(__dirname, '..', '.env');
const rootEnvPath = join(__dirname, '..', '..', '.env');

// Your Supabase credentials
const SUPABASE_URL = 'https://vjcupnypoxinqpkdzlol.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3Vwbnlwb3hpbnFwa2R6bG9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDIyODQxNCwiZXhwIjoyMDc5ODA0NDE0fQ.YueuNs64kMEwZKbi93glcGm0qCQ_aD1-E-ssJlhYRYU';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3Vwbnlwb3hpbnFwa2R6bG9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMjg0MTQsImV4cCI6MjA3OTgwNDQxNH0.8epBmoAXpgDd44OQ3_Jt8EuM2cXiqP3ttohZILs1wSM';

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     Updating Environment Files with Supabase Credentials ║');
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
console.log('✅ Updated server/.env');

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
console.log('✅ Updated root .env');

console.log('\n✅ Environment files updated successfully!\n');
console.log('Next steps:');
console.log('1. Verify the setup: cd server && node scripts/check-env.js');
console.log('2. Apply database migrations (see instructions below)');
console.log('3. Create admin account: node scripts/createAdmin.js admin@mtu.edu.ng Admin123! "Admin User"\n');

























