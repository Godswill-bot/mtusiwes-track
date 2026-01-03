/**
 * Supabase Connection Test
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     MTU SIWES - Supabase Integration Test              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// Check Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📋 Environment Variables:\n');
console.log(`  ${supabaseUrl ? '✅' : '❌'} SUPABASE_URL: ${supabaseUrl || 'NOT SET'}`);
console.log(`  ${serviceRoleKey ? '✅' : '❌'} SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '***' + serviceRoleKey.slice(-4) : 'NOT SET'}\n`);

if (!supabaseUrl || !serviceRoleKey) {
  console.log('❌ Missing required environment variables!');
  console.log('   Please check server/.env file\n');
  process.exit(1);
}

// Initialize Supabase Client
console.log('🔌 Initializing Supabase Client...\n');
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test 1: Query profiles table
console.log('📊 Test 1: Querying profiles table...');
try {
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  } else {
    console.log(`  ✅ Success! Profiles table accessible (${count || 0} records)\n`);
  }
} catch (err) {
  console.log(`  ❌ Exception: ${err.message}\n`);
}

// Test 2: Query settings table
console.log('📊 Test 2: Querying settings table...');
try {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1);

  if (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  } else {
    console.log(`  ✅ Success! Settings table accessible\n`);
  }
} catch (err) {
  console.log(`  ❌ Exception: ${err.message}\n`);
}

// Test 3: Query user_roles table
console.log('📊 Test 3: Querying user_roles table...');
try {
  const { data, error, count } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  } else {
    console.log(`  ✅ Success! user_roles table accessible (${count || 0} records)\n`);
  }
} catch (err) {
  console.log(`  ❌ Exception: ${err.message}\n`);
}

// Test 4: Check admin user
console.log('📊 Test 4: Checking admin user...');
try {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.log(`  ⚠️  Cannot list users (may need service role): ${listError.message}\n`);
  } else {
    const adminUser = users.users?.find(u => u.email === 'admin@mtu.edu.ng');
    if (adminUser) {
      console.log(`  ✅ Admin user found: ${adminUser.email}\n`);
    } else {
      console.log(`  ⚠️  Admin user not found\n`);
    }
  }
} catch (err) {
  console.log(`  ⚠️  Exception: ${err.message}\n`);
}

// Summary
console.log('═'.repeat(60) + '\n');
console.log('📊 Summary:\n');
console.log('✅ Supabase Client: Initialized');
console.log(`✅ Connection URL: ${supabaseUrl}`);
console.log('\n💡 Frontend uses: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
console.log('💡 Backend uses: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
console.log('\n📝 Note: This is a Vite project, not Next.js.');
console.log('   Use VITE_ prefix for frontend env vars, not NEXT_PUBLIC_\n');

























