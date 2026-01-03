/**
 * Fix existing users who have profiles but no student/supervisor records
 * Run with: node fix-existing-users.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Fix Existing Users - Create Missing Records             ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function fixExistingUsers() {
  try {
    // Get all profiles excluding admin
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No non-admin profiles found.\n');
      return;
    }

    console.log(`Found ${profiles.length} non-admin profile(s) to check...\n`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      console.log(`Checking: ${profile.full_name} (${profile.role})...`);

      if (profile.role === 'student') {
        // Check if student record exists
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (!existingStudent) {
          console.log(`  → Creating missing student record...`);
          
          // Get user email from auth
          const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
          
          if (!user) {
            console.log(`  ✗ Could not find auth user for ${profile.id}`);
            errorCount++;
            continue;
          }

          // Create student record with placeholder values
          const { error: studentError } = await supabase
            .from('students')
            .insert({
              user_id: profile.id,
              full_name: profile.full_name,
              email: user.email || 'unknown@mtu.edu.ng',
              matric_no: `TEMP-${Date.now()}-${profile.id.substring(0, 8)}`, // Temporary matric
              faculty: 'TBD',
              department: 'TBD',
              phone: '',
              // Required fields with placeholder values
              organisation_name: 'To be updated',
              organisation_address: 'To be updated',
              nature_of_business: 'To be updated',
              location_size: 'medium',
              products_services: 'To be updated',
              industry_supervisor_name: 'To be updated',
              period_of_training: 'To be updated',
            });

          if (studentError) {
            console.log(`  ✗ Error: ${studentError.message}`);
            errorCount++;
          } else {
            console.log(`  ✓ Student record created successfully`);
            fixedCount++;
          }
        } else {
          console.log(`  ✓ Student record already exists`);
        }
      } else if (profile.role === 'school_supervisor' || profile.role === 'industry_supervisor') {
        // Check if supervisor record exists
        const { data: existingSupervisor } = await supabase
          .from('supervisors')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (!existingSupervisor) {
          console.log(`  → Creating missing supervisor record...`);
          
          // Get user email from auth
          const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
          
          if (!user) {
            console.log(`  ✗ Could not find auth user for ${profile.id}`);
            errorCount++;
            continue;
          }

          // Create supervisor record
          const { error: supervisorError } = await supabase
            .from('supervisors')
            .insert({
              user_id: profile.id,
              name: profile.full_name,
              email: user.email || 'unknown@mtu.edu.ng',
              phone: '',
              supervisor_type: profile.role === 'school_supervisor' ? 'school_supervisor' : 'industry_supervisor',
            });

          if (supervisorError) {
            console.log(`  ✗ Error: ${supervisorError.message}`);
            errorCount++;
          } else {
            console.log(`  ✓ Supervisor record created successfully`);
            fixedCount++;
          }
        } else {
          console.log(`  ✓ Supervisor record already exists`);
        }
      }

      console.log('');
    }

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  SUMMARY                                                  ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Profiles checked:              ${profiles.length.toString().padStart(3)}                    ║`);
    console.log(`║  Records created:               ${fixedCount.toString().padStart(3)}                    ║`);
    console.log(`║  Errors:                        ${errorCount.toString().padStart(3)}                    ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    if (fixedCount > 0) {
      console.log('✓ Successfully created missing records!\n');
    } else if (errorCount > 0) {
      console.log('⚠ Some errors occurred. Check the output above.\n');
    } else {
      console.log('✓ All users already have their records.\n');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the fix
fixExistingUsers();

