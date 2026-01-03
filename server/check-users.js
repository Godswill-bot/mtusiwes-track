/**
 * Check for students and supervisors in the database
 * Run with: node check-users.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  MTU SIWES User Verification Report                      ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function checkStudents() {
  console.log('📚 Checking STUDENTS table...');
  try {
    const { data: students, error } = await supabase
      .from('students')
      .select('id, user_id, full_name, email, matric_no, faculty, department, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.log(`   ✗ Error: ${error.message}\n`);
      return { count: 0, users: [] };
    }

    console.log(`   ✓ Found ${students?.length || 0} student(s)\n`);
    
    if (students && students.length > 0) {
      console.log('   Student Details:');
      students.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.full_name || 'N/A'} (${student.email})`);
        console.log(`      Matric: ${student.matric_no || 'N/A'}`);
        console.log(`      Faculty: ${student.faculty || 'N/A'}, Department: ${student.department || 'N/A'}`);
        console.log(`      Created: ${new Date(student.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }

    return { count: students?.length || 0, users: students || [] };
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}\n`);
    return { count: 0, users: [] };
  }
}

async function checkSupervisors() {
  console.log('👨‍🏫 Checking SUPERVISORS table...');
  try {
    const { data: supervisors, error } = await supabase
      .from('supervisors')
      .select('id, user_id, name, email, phone, supervisor_type, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.log(`   ✗ Error: ${error.message}\n`);
      return { count: 0, users: [] };
    }

    console.log(`   ✓ Found ${supervisors?.length || 0} supervisor(s)\n`);
    
    if (supervisors && supervisors.length > 0) {
      console.log('   Supervisor Details:');
      supervisors.forEach((supervisor, index) => {
        console.log(`   ${index + 1}. ${supervisor.name || 'N/A'} (${supervisor.email})`);
        console.log(`      Type: ${supervisor.supervisor_type || 'N/A'}`);
        console.log(`      Phone: ${supervisor.phone || 'N/A'}`);
        console.log(`      Created: ${new Date(supervisor.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }

    return { count: supervisors?.length || 0, users: supervisors || [] };
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}\n`);
    return { count: 0, users: [] };
  }
}

async function checkProfiles() {
  console.log('👤 Checking PROFILES table (excluding admin)...');
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (error) {
      console.log(`   ✗ Error: ${error.message}\n`);
      return { count: 0, users: [] };
    }

    const students = profiles?.filter(p => p.role === 'student') || [];
    const schoolSupervisors = profiles?.filter(p => p.role === 'school_supervisor') || [];
    const industrySupervisors = profiles?.filter(p => p.role === 'industry_supervisor') || [];

    console.log(`   ✓ Found ${profiles?.length || 0} non-admin user(s) in profiles:`);
    console.log(`      - Students: ${students.length}`);
    console.log(`      - School Supervisors: ${schoolSupervisors.length}`);
    console.log(`      - Industry Supervisors: ${industrySupervisors.length}\n`);

    if (profiles && profiles.length > 0) {
      console.log('   Profile Details:');
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.full_name || 'N/A'} (Role: ${profile.role})`);
        console.log(`      Created: ${new Date(profile.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }

    return { 
      count: profiles?.length || 0, 
      users: profiles || [],
      breakdown: {
        students: students.length,
        schoolSupervisors: schoolSupervisors.length,
        industrySupervisors: industrySupervisors.length
      }
    };
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}\n`);
    return { count: 0, users: [] };
  }
}

async function generateReport() {
  const studentsResult = await checkStudents();
  const supervisorsResult = await checkSupervisors();
  const profilesResult = await checkProfiles();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY REPORT                                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Students in 'students' table:        ${studentsResult.count.toString().padStart(3)}                    ║`);
  console.log(`║  Supervisors in 'supervisors' table:   ${supervisorsResult.count.toString().padStart(3)}                    ║`);
  console.log(`║  Total non-admin profiles:             ${profilesResult.count.toString().padStart(3)}                    ║`);
  
  if (profilesResult.breakdown) {
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Breakdown by role:                                      ║`);
    console.log(`║    - Students:              ${profilesResult.breakdown.students.toString().padStart(3)}                    ║`);
    console.log(`║    - School Supervisors:    ${profilesResult.breakdown.schoolSupervisors.toString().padStart(3)}                    ║`);
    console.log(`║    - Industry Supervisors:  ${profilesResult.breakdown.industrySupervisors.toString().padStart(3)}                    ║`);
  }
  
  const totalUsers = studentsResult.count + supervisorsResult.count;
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  TOTAL USERS (excluding admin):        ${totalUsers.toString().padStart(3)}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (totalUsers === 0) {
    console.log('⚠️  No students or supervisors found in the system.');
    console.log('   The system is ready for new registrations.\n');
  } else {
    console.log('✓ Users found in the system.\n');
  }

  return {
    students: studentsResult,
    supervisors: supervisorsResult,
    profiles: profilesResult,
    total: totalUsers
  };
}

// Run the check
generateReport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

