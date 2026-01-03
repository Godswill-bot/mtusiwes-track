/**
 * Environment Variables Checker
 * Checks if required environment variables are set
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from server directory
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     MTU SIWES - Environment Variables Checker            ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const requiredVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const optionalVars = {
  'EMAIL_USER': process.env.EMAIL_USER,
  'EMAIL_PASS': process.env.EMAIL_PASS,
  'PORT': process.env.PORT || '3001 (default)',
  'FRONTEND_URL': process.env.FRONTEND_URL || 'http://localhost:8080 (default)',
};

let allValid = true;

console.log('📋 Required Variables:\n');
for (const [key, value] of Object.entries(requiredVars)) {
  const isValid = value && value.trim().length > 0;
  const status = isValid ? '✅' : '❌';
  const displayValue = isValid 
    ? (key.includes('KEY') ? '***' + value.slice(-4) : value.substring(0, 50))
    : 'NOT SET';
  
  console.log(`  ${status} ${key}: ${displayValue}`);
  
  if (!isValid) {
    allValid = false;
  }
}

console.log('\n📋 Optional Variables:\n');
for (const [key, value] of Object.entries(optionalVars)) {
  const isValid = value && value.trim().length > 0;
  const status = isValid ? '✅' : '⚠️ ';
  const displayValue = isValid ? value : 'NOT SET';
  
  console.log(`  ${status} ${key}: ${displayValue}`);
}

console.log('\n' + '═'.repeat(60) + '\n');

if (allValid) {
  // Validate URL format
  const url = process.env.SUPABASE_URL;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.log('❌ SUPABASE_URL is invalid!');
    console.log('   It must start with http:// or https://\n');
    console.log('   Current value:', url || '(empty)');
    console.log('\n   Please update your .env file with a valid Supabase URL.\n');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set!\n');
  console.log('You can now run the createAdmin script:\n');
  console.log('  node scripts/createAdmin.js admin@mtu.edu.ng Admin123! "Admin User"\n');
} else {
  console.log('❌ Some required environment variables are missing!\n');
  console.log('Please update your .env file in the server directory.\n');
  console.log('Required variables:');
  console.log('  - SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY\n');
  console.log('You can find these in your Supabase dashboard:');
  console.log('  https://supabase.com/dashboard/project/jcxshefzlzjwsxmifmqd/settings/api\n');
  console.log('Or run the setup script to update:');
  console.log('  node scripts/setup-env.js\n');
  process.exit(1);
}

























