/**
 * Supabase Connection Test Script
 * Tests both frontend and backend Supabase connections
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     MTU SIWES - Supabase Integration Test              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Load environment variables
const rootEnvPath = join(__dirname, '.env');
const serverEnvPath = join(__dirname, 'server', '.env');

let rootEnv = {};
let serverEnv = {};

if (existsSync(rootEnvPath)) {
  const rootEnvContent = readFileSync(rootEnvPath, 'utf-8');
  rootEnvContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      rootEnv[match[1].trim()] = match[2].trim();
    }
  });
}

if (existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
  serverEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

// Check Frontend Environment Variables
console.log('📋 Frontend Environment Variables (Vite):\n');
const frontendUrl = rootEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const frontendKey = rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log(`  ${frontendUrl ? '✅' : '❌'} VITE_SUPABASE_URL: ${frontendUrl || 'NOT SET'}`);
console.log(`  ${frontendKey ? '✅' : '❌'} VITE_SUPABASE_PUBLISHABLE_KEY: ${frontendKey ? '***' + frontendKey.slice(-4) : 'NOT SET'}`);

// Check Backend Environment Variables
console.log('\n📋 Backend Environment Variables (Node.js):\n');
console.log(`  ${serverEnv.SUPABASE_URL ? '✅' : '❌'} SUPABASE_URL: ${serverEnv.SUPABASE_URL || 'NOT SET'}`);
console.log(`  ${serverEnv.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'} SUPABASE_SERVICE_ROLE_KEY: ${serverEnv.SUPABASE_SERVICE_ROLE_KEY ? '***' + serverEnv.SUPABASE_SERVICE_ROLE_KEY.slice(-4) : 'NOT SET'}`);

// Test Backend Connection
console.log('\n🔌 Testing Backend Connection...\n');

if (serverEnv.SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const backendClient = createClient(
      serverEnv.SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Test query - get count of profiles
    const { data, error, count } = await backendClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('  ❌ Backend Connection Failed:');
      console.log(`     Error: ${error.message}`);
    } else {
      console.log('  ✅ Backend Connection: SUCCESS');
      console.log(`     Profiles table accessible (count: ${count || 'N/A'})`);
    }

    // Test query on settings table
    const { data: settingsData, error: settingsError } = await backendClient
      .from('settings')
      .select('*')
      .limit(1);

    if (!settingsError) {
      console.log('  ✅ Settings table accessible');
    }

  } catch (err) {
    console.log('  ❌ Backend Connection Error:');
    console.log(`     ${err.message}`);
  }
} else {
  console.log('  ⚠️  Backend credentials missing - skipping test');
}

// Test Frontend Connection
console.log('\n🔌 Testing Frontend Connection...\n');

if (frontendUrl && frontendKey) {
  try {
    const frontendClient = createClient(
      frontendUrl,
      frontendKey,
      {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );

    // Test query - get count of profiles (without auth, should work with RLS)
    const { data, error, count } = await frontendClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('  ⚠️  Frontend Connection (without auth):');
      console.log(`     Note: ${error.message}`);
      console.log('     This is normal - RLS requires authentication');
    } else {
      console.log('  ✅ Frontend Connection: SUCCESS');
      console.log(`     Profiles table accessible (count: ${count || 'N/A'})`);
    }

  } catch (err) {
    console.log('  ❌ Frontend Connection Error:');
    console.log(`     ${err.message}`);
  }
} else {
  console.log('  ⚠️  Frontend credentials missing - skipping test');
}

// Summary
console.log('\n' + '═'.repeat(60) + '\n');
console.log('📊 Summary:\n');

const backendOk = serverEnv.SUPABASE_URL && serverEnv.SUPABASE_SERVICE_ROLE_KEY;
const frontendOk = frontendUrl && frontendKey;

if (backendOk && frontendOk) {
  console.log('✅ Supabase Integration: CONFIGURED');
  console.log('\n✅ Frontend: Using VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  console.log('✅ Backend: Using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.log('\n📝 Note: This is a Vite project, not Next.js.');
  console.log('   Environment variables use VITE_ prefix, not NEXT_PUBLIC_ prefix.\n');
} else {
  console.log('❌ Supabase Integration: INCOMPLETE');
  if (!frontendOk) {
    console.log('\n❌ Missing Frontend Variables:');
    console.log('   - VITE_SUPABASE_URL');
    console.log('   - VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  if (!backendOk) {
    console.log('\n❌ Missing Backend Variables:');
    console.log('   - SUPABASE_URL');
    console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  }
  console.log('\n💡 Create/update .env files in root and server/ directories.\n');
}

























