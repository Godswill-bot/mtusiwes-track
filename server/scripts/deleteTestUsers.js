/**
 * Test User Deletion Script
 * Safely identifies and deletes test accounts and associated data
 * 
 * Usage: node server/scripts/deleteTestUsers.js [--confirm]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Patterns to identify test users
const TEST_PATTERNS = {
  email: [
    /test/i,
    /demo/i,
    /example/i,
    /sample/i,
    /temp/i,
    /trial/i,
    /fake/i,
    /dummy/i,
    /@test\./i,
    /@example\./i,
  ],
  name: [
    /test/i,
    /demo/i,
    /example/i,
    /sample/i,
    /temp/i,
    /trial/i,
    /fake/i,
    /dummy/i,
  ],
  matric: [
    /^test/i,
    /^demo/i,
    /^000/i,
    /^999/i,
  ],
};

/**
 * Check if a user matches test patterns
 */
const isTestUser = (user) => {
  const email = user.email?.toLowerCase() || '';
  const name = (user.full_name || user.name || '').toLowerCase();
  const matric = (user.matric_no || '').toLowerCase();

  // Check email patterns
  if (TEST_PATTERNS.email.some(pattern => pattern.test(email))) {
    return true;
  }

  // Check name patterns
  if (TEST_PATTERNS.name.some(pattern => pattern.test(name))) {
    return true;
  }

  // Check matric patterns
  if (matric && TEST_PATTERNS.matric.some(pattern => pattern.test(matric))) {
    return true;
  }

  return false;
};

/**
 * Find all test users
 */
const findTestUsers = async () => {
  console.log('🔍 Searching for test users...\n');

  // Find test students
  const { data: allStudents, error: studentsError } = await supabase
    .from('students')
    .select('*, user:profiles(id, full_name, email)');

  if (studentsError) {
    console.error('Error fetching students:', studentsError);
    return { students: [], supervisors: [] };
  }

  const testStudents = allStudents?.filter(student => {
    const user = student.user || {};
    return isTestUser({
      email: user.email || student.email,
      full_name: user.full_name || student.full_name,
      matric_no: student.matric_no,
    });
  }) || [];

  // Find test supervisors
  const { data: allSupervisors, error: supervisorsError } = await supabase
    .from('supervisors')
    .select('*, user:profiles(id, full_name, email)');

  if (supervisorsError) {
    console.error('Error fetching supervisors:', supervisorsError);
    return { students: testStudents, supervisors: [] };
  }

  const testSupervisors = allSupervisors?.filter(supervisor => {
    const user = supervisor.user || {};
    return isTestUser({
      email: user.email || supervisor.email,
      full_name: user.full_name || supervisor.name,
    });
  }) || [];

  return { students: testStudents, supervisors: testSupervisors };
};

/**
 * Delete user and all associated data
 */
const deleteUserData = async (userId, userType) => {
  try {
    console.log(`  Deleting ${userType} data for user ${userId}...`);

    if (userType === 'student') {
      // Get student ID
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentData) {
        const studentId = studentData.id;

        // Delete weekly reports (cascades to photos)
        const { error: weeksError } = await supabase
          .from('weeks')
          .delete()
          .eq('student_id', studentId);

        if (weeksError) console.error(`    Error deleting weeks:`, weeksError);

        // Delete supervisor grades
        const { error: gradesError } = await supabase
          .from('supervisor_grades')
          .delete()
          .eq('student_id', studentId);

        if (gradesError) console.error(`    Error deleting grades:`, gradesError);

        // Delete student record
        const { error: studentError } = await supabase
          .from('students')
          .delete()
          .eq('id', studentId);

        if (studentError) console.error(`    Error deleting student:`, studentError);
      }
    } else if (userType === 'supervisor') {
      // Get supervisor ID
      const { data: supervisorData } = await supabase
        .from('supervisors')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (supervisorData) {
        const supervisorId = supervisorData.id;

        // Delete supervisor grades
        const { error: gradesError } = await supabase
          .from('supervisor_grades')
          .delete()
          .eq('supervisor_id', supervisorId);

        if (gradesError) console.error(`    Error deleting grades:`, gradesError);

        // Delete supervisor record
        const { error: supervisorError } = await supabase
          .from('supervisors')
          .delete()
          .eq('id', supervisorId);

        if (supervisorError) console.error(`    Error deleting supervisor:`, supervisorError);
      }
    }

    // Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) console.error(`    Error deleting profile:`, profileError);

    // Delete auth user (this will cascade delete related records)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) console.error(`    Error deleting auth user:`, authError);

    console.log(`  ✅ Deleted ${userType} user ${userId}`);
  } catch (error) {
    console.error(`  ❌ Error deleting user ${userId}:`, error);
  }
};

/**
 * Main execution
 */
const main = async () => {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--confirm');

  console.log(`
╔══════════════════════════════════════════════════════════╗
║     MTU SIWES - Test User Deletion Script               ║
╚══════════════════════════════════════════════════════════╝
  `);

  // Find test users
  const { students, supervisors } = await findTestUsers();

  const totalTestUsers = students.length + supervisors.length;

  if (totalTestUsers === 0) {
    console.log('✅ No test users found. All accounts appear to be real users.\n');
    process.exit(0);
  }

  // Display found test users
  console.log(`\n📋 Found ${totalTestUsers} test user(s):\n`);

  if (students.length > 0) {
    console.log('👨‍🎓 Test Students:');
    students.forEach((student, index) => {
      const user = student.user || {};
      console.log(`  ${index + 1}. ${user.full_name || student.full_name || 'Unknown'} (${user.email || student.email || 'No email'})`);
      console.log(`     Matric: ${student.matric_no || 'N/A'}`);
      console.log(`     User ID: ${student.user_id}`);
    });
    console.log('');
  }

  if (supervisors.length > 0) {
    console.log('👨‍🏫 Test Supervisors:');
    supervisors.forEach((supervisor, index) => {
      const user = supervisor.user || {};
      console.log(`  ${index + 1}. ${user.full_name || supervisor.name || 'Unknown'} (${user.email || supervisor.email || 'No email'})`);
      console.log(`     Type: ${supervisor.supervisor_type || 'N/A'}`);
      console.log(`     User ID: ${supervisor.user_id}`);
    });
    console.log('');
  }

  // Confirmation
  if (!confirmed) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      rl.question('⚠️  WARNING: This will permanently delete all test users and their data.\n   Type "DELETE" to confirm: ', resolve);
    });

    rl.close();

    if (answer !== 'DELETE') {
      console.log('\n❌ Deletion cancelled. No users were deleted.\n');
      process.exit(0);
    }
  }

  // Delete test users
  console.log('\n🗑️  Deleting test users...\n');

  for (const student of students) {
    await deleteUserData(student.user_id, 'student');
  }

  for (const supervisor of supervisors) {
    await deleteUserData(supervisor.user_id, 'supervisor');
  }

  console.log(`\n✅ Deletion complete! Deleted ${totalTestUsers} test user(s).\n`);
};

// Run script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});




