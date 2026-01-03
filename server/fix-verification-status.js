/**
 * Fix email verification status for users who verified but status was lost
 * Run with: node fix-verification-status.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Fix Email Verification Status                          ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function fixVerificationStatus() {
  try {
    // Get all users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error fetching users:', listError);
      return;
    }

    console.log(`Found ${users.length} user(s) to check...\n`);

    let fixedCount = 0;
    let alreadyVerifiedCount = 0;

    for (const user of users) {
      const email = user.email;
      if (!email || !email.endsWith('@mtu.edu.ng')) continue;

      // Check if user has verified their email (email_confirmed_at is set)
      const isEmailConfirmed = !!user.email_confirmed_at;
      
      // Check current verification status in metadata
      const isVerifiedInMetadata = user.user_metadata?.email_verified;
      
      // Check profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', user.id)
        .maybeSingle();
      
      const isVerifiedInProfile = profile?.email_verified;

      // If email is confirmed but not marked as verified, fix it
      if (isEmailConfirmed && (!isVerifiedInMetadata || !isVerifiedInProfile)) {
        console.log(`Fixing: ${email}...`);
        
        // Update user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          {
            user_metadata: {
              ...user.user_metadata,
              email_verified: true,
              verified_at: user.email_confirmed_at || new Date().toISOString(),
            },
          }
        );

        if (updateError) {
          console.log(`  ✗ Error updating metadata: ${updateError.message}`);
          continue;
        }

        // Update profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('id', user.id);

        if (profileError) {
          console.log(`  ⚠ Profile update warning: ${profileError.message}`);
        }

        console.log(`  ✓ Fixed verification status`);
        fixedCount++;
      } else if (isEmailConfirmed && isVerifiedInMetadata && isVerifiedInProfile) {
        alreadyVerifiedCount++;
      }
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  SUMMARY                                                  ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Users checked:              ${users.length.toString().padStart(3)}                    ║`);
    console.log(`║  Fixed:                      ${fixedCount.toString().padStart(3)}                    ║`);
    console.log(`║  Already verified:            ${alreadyVerifiedCount.toString().padStart(3)}                    ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    if (fixedCount > 0) {
      console.log('✓ Successfully fixed verification status for users!\n');
    } else {
      console.log('✓ All users have correct verification status.\n');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the fix
fixVerificationStatus();

