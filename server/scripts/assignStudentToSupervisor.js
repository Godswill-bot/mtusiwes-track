/**
 * Script to assign Godswill Nwafor to Dr. Akindele
 * This script will:
 * 1. Find the student and supervisor
 * 2. Create supervisor if missing (if auth user exists)
 * 3. Assign student to supervisor
 * 4. Verify the assignment
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in server/.env');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findStudent() {
  console.log('\n🔍 Searching for student "Godswill Nwafor"...');
  
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, email, matric_no, department, faculty, school_supervisor_name, school_supervisor_email')
    .or('full_name.ilike.%godswill%,full_name.ilike.%nwafor%,matric_no.ilike.%godswill%,email.ilike.%godswill%,email.ilike.%nwafor%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error searching for student:', error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log('❌ No student found matching "Godswill" or "Nwafor"');
    return null;
  }

  console.log(`✅ Found ${data.length} student(s):`);
  data.forEach((student, index) => {
    console.log(`   ${index + 1}. ${student.full_name} (${student.email || student.matric_no})`);
    console.log(`      ID: ${student.id}`);
    if (student.school_supervisor_name) {
      console.log(`      Current Supervisor: ${student.school_supervisor_name}`);
    }
  });

  return data[0]; // Return first match
}

async function findSupervisor() {
  console.log('\n🔍 Searching for supervisor "Dr. Akindele"...');
  
  const { data, error } = await supabase
    .from('supervisors')
    .select('id, name, email, supervisor_type, is_active, user_id')
    .eq('supervisor_type', 'school_supervisor')
    .or('email.ilike.%akindele%,name.ilike.%akindele%,email.ilike.%adebabyo%')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error searching for supervisor:', error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log('❌ No supervisor found matching "akindele"');
    console.log('\n📋 Listing all school supervisors:');
    
    const { data: allSupervisors } = await supabase
      .from('supervisors')
      .select('id, name, email, supervisor_type, is_active')
      .eq('supervisor_type', 'school_supervisor')
      .order('name');
    
    if (allSupervisors && allSupervisors.length > 0) {
      allSupervisors.forEach((sup, index) => {
        console.log(`   ${index + 1}. ${sup.name} (${sup.email}) - Active: ${sup.is_active}`);
      });
    } else {
      console.log('   No school supervisors found in database');
    }
    
    return null;
  }

  console.log(`✅ Found ${data.length} supervisor(s):`);
  data.forEach((supervisor, index) => {
    console.log(`   ${index + 1}. ${supervisor.name} (${supervisor.email})`);
    console.log(`      ID: ${supervisor.id}`);
  });

  // Prefer exact email match
  const exactMatch = data.find(s => s.email === 'akindeleadebabyo@mtu.edu.ng');
  return exactMatch || data[0];
}

async function createSupervisorIfNeeded() {
  console.log('\n🔍 Checking if supervisor needs to be created...');
  
  // Check if auth user exists
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error checking auth users:', authError);
    return null;
  }

  const authUser = authUsers.users.find(u => u.email === 'akindeleadebabyo@mtu.edu.ng');
  
  if (!authUser) {
    console.log('⚠️  Auth user "akindeleadebabyo@mtu.edu.ng" does not exist');
    console.log('   Please create the supervisor account via Admin Dashboard first');
    return null;
  }

  console.log(`✅ Auth user exists: ${authUser.email} (ID: ${authUser.id})`);

  // Check if supervisor record exists
  const { data: existingSupervisor } = await supabase
    .from('supervisors')
    .select('id')
    .eq('user_id', authUser.id)
    .eq('supervisor_type', 'school_supervisor')
    .maybeSingle();

  if (existingSupervisor) {
    console.log('✅ Supervisor record already exists');
    return existingSupervisor.id;
  }

  // Create supervisor record
  console.log('📝 Creating supervisor record...');
  const { data: newSupervisor, error: createError } = await supabase
    .from('supervisors')
    .insert({
      user_id: authUser.id,
      name: 'Dr. Akindele',
      email: 'akindeleadebabyo@mtu.edu.ng',
      supervisor_type: 'school_supervisor',
      is_active: true
    })
    .select('id')
    .single();

  if (createError) {
    console.error('❌ Error creating supervisor record:', createError);
    return null;
  }

  console.log(`✅ Created supervisor record with ID: ${newSupervisor.id}`);
  return newSupervisor.id;
}

async function getCurrentSession() {
  const { data, error } = await supabase
    .from('academic_sessions')
    .select('id, session_name')
    .eq('is_current', true)
    .maybeSingle();

  if (error) {
    console.error('❌ Error finding current session:', error);
    return null;
  }

  if (!data) {
    console.log('⚠️  No current academic session found');
    return null;
  }

  console.log(`✅ Current session: ${data.session_name} (ID: ${data.id})`);
  return data.id;
}

async function assignStudentToSupervisor(studentId, supervisorId, sessionId) {
  console.log('\n📝 Assigning student to supervisor...');
  console.log(`   Student ID: ${studentId}`);
  console.log(`   Supervisor ID: ${supervisorId}`);
  console.log(`   Session ID: ${sessionId}`);

  // Insert/update supervisor assignment
  const { error: assignmentError } = await supabase
    .from('supervisor_assignments')
    .upsert({
      supervisor_id: supervisorId,
      student_id: studentId,
      session_id: sessionId,
      assignment_type: 'school_supervisor',
      assigned_by: null,
      assigned_at: new Date().toISOString()
    }, {
      onConflict: 'supervisor_id,student_id,session_id,assignment_type'
    });

  if (assignmentError) {
    console.error('❌ Error creating assignment:', assignmentError);
    return false;
  }

  // Get supervisor details
  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('name, email')
    .eq('id', supervisorId)
    .single();

  if (!supervisor) {
    console.error('❌ Could not fetch supervisor details');
    return false;
  }

  // Update students table
  const { error: updateError } = await supabase
    .from('students')
    .update({
      school_supervisor_email: supervisor.email,
      school_supervisor_name: supervisor.name
    })
    .eq('id', studentId);

  if (updateError) {
    console.error('❌ Error updating student record:', updateError);
    return false;
  }

  console.log('✅ Assignment successful!');
  return true;
}

async function verifyAssignment(studentId) {
  console.log('\n🔍 Verifying assignment...');
  
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      full_name,
      matric_no,
      school_supervisor_name,
      school_supervisor_email,
      supervisor_assignments!inner (
        supervisor_id,
        assigned_at,
        supervisors (
          name,
          email
        )
      )
    `)
    .eq('id', studentId)
    .single();

  if (error) {
    console.error('❌ Error verifying assignment:', error);
    return;
  }

  if (data) {
    console.log('\n✅ VERIFICATION RESULTS:');
    console.log(`   Student: ${data.full_name} (${data.matric_no})`);
    console.log(`   School Supervisor: ${data.school_supervisor_name || 'Not assigned'}`);
    console.log(`   Supervisor Email: ${data.school_supervisor_email || 'Not assigned'}`);
    
    if (data.supervisor_assignments && data.supervisor_assignments.length > 0) {
      const assignment = data.supervisor_assignments[0];
      console.log(`   Assignment Date: ${new Date(assignment.assigned_at).toLocaleString()}`);
      if (assignment.supervisors) {
        console.log(`   Supervisor Details: ${assignment.supervisors.name} (${assignment.supervisors.email})`);
      }
    }
  }
}

async function main() {
  console.log('🚀 Starting assignment process...\n');
  console.log('='.repeat(60));

  // Step 1: Find student
  const student = await findStudent();
  if (!student) {
    console.log('\n❌ Cannot proceed without student. Please check the database.');
    process.exit(1);
  }

  // Step 2: Find or create supervisor
  let supervisor = await findSupervisor();
  if (!supervisor) {
    console.log('\n⚠️  Supervisor not found. Attempting to create from auth user...');
    const supervisorId = await createSupervisorIfNeeded();
    if (supervisorId) {
      const { data } = await supabase
        .from('supervisors')
        .select('id, name, email')
        .eq('id', supervisorId)
        .single();
      if (data) {
        supervisor = { id: data.id, name: data.name, email: data.email };
      }
    }
  }

  if (!supervisor) {
    console.log('\n❌ Cannot proceed without supervisor.');
    console.log('   Please create the supervisor account via Admin Dashboard first.');
    process.exit(1);
  }

  // Step 3: Get current session
  const sessionId = await getCurrentSession();
  if (!sessionId) {
    console.log('\n❌ Cannot proceed without current academic session.');
    process.exit(1);
  }

  // Step 4: Assign
  const success = await assignStudentToSupervisor(student.id, supervisor.id, sessionId);
  
  if (!success) {
    console.log('\n❌ Assignment failed. Please check the errors above.');
    process.exit(1);
  }

  // Step 5: Verify
  await verifyAssignment(student.id);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Assignment process completed successfully!');
  console.log('\n📱 Next steps:');
  console.log('   1. Check student dashboard - should show supervisor');
  console.log('   2. Login as supervisor - should see student in pending registrations');
  console.log('   3. Supervisor can approve/reject pre-registration');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});



