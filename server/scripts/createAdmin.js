/**
 * Admin Account Creation Script
 * Creates an admin user in Supabase Auth and the admins table
 * 
 * Usage: node server/scripts/createAdmin.js <email> <password> <full_name>
 * Example: node server/scripts/createAdmin.js admin@mtu.edu.ng Admin123! "Admin User"
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from server directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables!\n');
  console.error('Please create a .env file in the server directory with:');
  console.error('  SUPABASE_URL=your_supabase_url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key\n');
  console.error('Example .env file location: server/.env\n');
  process.exit(1);
}

if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  console.error('\n❌ Invalid SUPABASE_URL format!\n');
  console.error('SUPABASE_URL must be a valid HTTP or HTTPS URL.');
  console.error(`Current value: ${supabaseUrl || '(empty)'}\n`);
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const createAdmin = async (email, password, fullName) => {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║     MTU SIWES - Admin Account Creation Script            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Validate email format
    if (!email || !email.includes('@')) {
      throw new Error('Valid email address is required');
    }

    // Validate password
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Validate full name
    if (!fullName || fullName.trim().length === 0) {
      throw new Error('Full name is required');
    }

    console.log(`Creating admin account for: ${email}`);
    console.log(`Full Name: ${fullName}\n`);

    // Check if user already exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      console.log('⚠️  User with this email already exists in auth.users');
      console.log(`   User ID: ${existingUser.id}`);
      
      // Check if admin record exists
      const { data: existingAdmin } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', existingUser.id)
        .single();

      if (existingAdmin) {
        console.log('✅ Admin record already exists in admins table');
        console.log(`   Admin ID: ${existingAdmin.id}`);
        console.log('\n📧 Admin credentials:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: [Use existing password or reset via Supabase Dashboard]\n`);
        return;
      } else {
        // User exists but no admin record - create admin record
        console.log('   Creating admin record...');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .insert({
            user_id: existingUser.id,
            full_name: fullName,
            email: email,
            hashed_password: hashedPassword,
            is_active: true,
          })
          .select()
          .single();

        if (adminError) throw adminError;

        // Create user role
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: existingUser.id,
            role: 'admin',
          }, {
            onConflict: 'user_id'
          });

        if (roleError) {
          console.warn('⚠️  Warning: Could not create user role:', roleError.message);
        }

        // Create profile if it doesn't exist
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: existingUser.id,
            full_name: fullName,
            role: 'admin',
            email_verified: true,
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.warn('⚠️  Warning: Could not create profile:', profileError.message);
        }

        console.log('✅ Admin record created successfully!');
        console.log(`   Admin ID: ${adminData.id}`);
        console.log('\n📧 Admin credentials:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log('\n⚠️  Note: You may need to reset the password in Supabase Dashboard');
        console.log('   if the existing user has a different password.\n');
        return;
      }
    }

    // Create new auth user
    console.log('Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email for admin
      user_metadata: {
        full_name: fullName,
        role: 'admin',
      },
    });

    if (authError) throw authError;

    console.log('✅ Auth user created successfully!');
    console.log(`   User ID: ${authData.user.id}\n`);

    // Hash password for admins table
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin record
    console.log('Creating admin record...');
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        email: email,
        hashed_password: hashedPassword,
        is_active: true,
      })
      .select()
      .single();

    if (adminError) throw adminError;

    console.log('✅ Admin record created successfully!');
    console.log(`   Admin ID: ${adminData.id}\n`);

    // Create user role
    console.log('Creating user role...');
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
      });

    if (roleError) {
      console.warn('⚠️  Warning: Could not create user role:', roleError.message);
    } else {
      console.log('✅ User role created successfully!\n');
    }

    // Create profile
    console.log('Creating profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: fullName,
        role: 'admin',
        email_verified: true,
      });

    if (profileError) {
      console.warn('⚠️  Warning: Could not create profile:', profileError.message);
    } else {
      console.log('✅ Profile created successfully!\n');
    }

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SUCCESS!                           ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log('📧 Admin Account Created:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Full Name: ${fullName}`);
    console.log('\n🔐 You can now log in at: /admin/login\n');

  } catch (error) {
    console.error('\n❌ Error creating admin account:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }
};

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('\n❌ Missing required arguments!\n');
  console.log('Usage: node server/scripts/createAdmin.js <email> <password> <full_name>');
  console.log('\nExample:');
  console.log('  node server/scripts/createAdmin.js admin@mtu.edu.ng Admin123! "Admin User"\n');
  process.exit(1);
}

const [email, password, fullName] = args;

// Run script
createAdmin(email, password, fullName);

