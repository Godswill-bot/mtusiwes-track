/**
 * QA TEST ACCOUNT CREATION SCRIPT
 * ================================
 * This script creates controlled dummy accounts for testing the Digital SIWES Tracking System.
 * 
 * Created accounts:
 * - 3 School Supervisor accounts
 * - 3 Student accounts
 * 
 * All accounts are marked as TEST/DUMMY and use consistent naming.
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vjcupnypoxinqpkdzlol.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqY3Vwbnlwb3hpbnFwa2R6bG9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDIyODQxNCwiZXhwIjoyMDc5ODA0NDE0fQ.YueuNs64kMEwZKbi93glcGm0qCQ_aD1-E-ssJlhYRYU';

// Create admin client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test Data
const SUPERVISORS = [
  {
    email: 'test.supervisor.a@mtu-siwes.test',
    password: 'TestSuper@123',
    fullName: 'Test Supervisor A',
    phone: '+234-800-000-0001',
    role: 'school_supervisor'
  },
  {
    email: 'test.supervisor.b@mtu-siwes.test',
    password: 'TestSuper@123',
    fullName: 'Test Supervisor B',
    phone: '+234-800-000-0002',
    role: 'school_supervisor'
  },
  {
    email: 'test.supervisor.c@mtu-siwes.test',
    password: 'TestSuper@123',
    fullName: 'Test Supervisor C',
    phone: '+234-800-000-0003',
    role: 'school_supervisor'
  }
];

const STUDENTS = [
  {
    email: 'test.student.1@mtu-siwes.test',
    password: 'TestStudent@123',
    fullName: 'Test Student 1',
    matricNo: 'TEST/2025/001',
    department: 'Computer Science',
    faculty: 'CBAS',
    phone: '+234-900-000-0001',
    organisationName: 'Test Tech Solutions Ltd',
    organisationAddress: '123 Test Street, Lagos',
    industrySupervisorName: 'Mr. Industry Test A',
    industrySupervisorEmail: 'industry.a@testcompany.com',
    industrySupervisorPhone: '+234-700-000-0001',
    role: 'student'
  },
  {
    email: 'test.student.2@mtu-siwes.test',
    password: 'TestStudent@123',
    fullName: 'Test Student 2',
    matricNo: 'TEST/2025/002',
    department: 'Software Engineering',
    faculty: 'CBAS',
    phone: '+234-900-000-0002',
    organisationName: 'Test Innovation Hub',
    organisationAddress: '456 Demo Avenue, Abuja',
    industrySupervisorName: 'Mrs. Industry Test B',
    industrySupervisorEmail: 'industry.b@testcompany.com',
    industrySupervisorPhone: '+234-700-000-0002',
    role: 'student'
  },
  {
    email: 'test.student.3@mtu-siwes.test',
    password: 'TestStudent@123',
    fullName: 'Test Student 3',
    matricNo: 'TEST/2025/003',
    department: 'Cybersecurity',
    faculty: 'CBAS',
    phone: '+234-900-000-0003',
    organisationName: 'Test Digital Agency',
    organisationAddress: '789 Sample Road, Port Harcourt',
    industrySupervisorName: 'Dr. Industry Test C',
    industrySupervisorEmail: 'industry.c@testcompany.com',
    industrySupervisorPhone: '+234-700-000-0003',
    role: 'student'
  }
];

// Store created accounts for final summary
const createdSupervisors = [];
const createdStudents = [];

async function fixNotificationTrigger() {
  console.log('🔧 Note: If student creation fails, you may need to run FIX_NOTIFICATION_TRIGGER.sql in Supabase SQL Editor');
  return; // Skip auto-fix since we can't run raw SQL via client
}

async function getCurrentSession() {
  const { data, error } = await supabase
    .from('academic_sessions')
    .select('*')
    .eq('is_current', true)
    .single();

  if (error) {
    console.log('⚠️  No current academic session found. Creating one...');
    // Create a session if none exists
    const { data: newSession, error: createError } = await supabase
      .from('academic_sessions')
      .insert({
        session_name: '2025/2026',
        is_current: true
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create academic session: ${createError.message}`);
    }
    return newSession;
  }
  return data;
}

async function createSupervisorAccount(supervisorData) {
  console.log(`\n📝 Creating supervisor: ${supervisorData.fullName}...`);

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === supervisorData.email);
    
    if (existingUser) {
      console.log(`⚠️  Supervisor ${supervisorData.email} already exists. Skipping creation.`);
      return { exists: true, userId: existingUser.id, email: supervisorData.email };
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: supervisorData.email,
      password: supervisorData.password,
      email_confirm: true, // Auto-confirm email for testing
      user_metadata: {
        full_name: supervisorData.fullName,
        role: supervisorData.role
      }
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: supervisorData.fullName,
        role: supervisorData.role
      });

    if (profileError) {
      console.log(`⚠️  Profile error: ${profileError.message}`);
    }

    // Create user_roles entry
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: supervisorData.role
      });

    if (roleError) {
      console.log(`⚠️  Role error: ${roleError.message}`);
    }

    // Create supervisor record
    const { error: supervisorError } = await supabase
      .from('supervisors')
      .upsert({
        user_id: userId,
        name: supervisorData.fullName,
        email: supervisorData.email,
        phone: supervisorData.phone,
        supervisor_type: supervisorData.role,
        is_active: true
      });

    if (supervisorError) {
      console.log(`⚠️  Supervisor record error: ${supervisorError.message}`);
    }

    console.log(`✅ Created supervisor: ${supervisorData.fullName} (${supervisorData.email})`);
    
    return {
      success: true,
      userId,
      email: supervisorData.email,
      password: supervisorData.password,
      name: supervisorData.fullName
    };

  } catch (error) {
    console.error(`❌ Failed to create supervisor ${supervisorData.email}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function createStudentAccount(studentData, sessionId) {
  console.log(`\n📝 Creating student: ${studentData.fullName}...`);

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === studentData.email);
    
    if (existingUser) {
      console.log(`⚠️  Student ${studentData.email} already exists. Skipping creation.`);
      return { exists: true, userId: existingUser.id, email: studentData.email };
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: studentData.email,
      password: studentData.password,
      email_confirm: true, // Auto-confirm email for testing
      user_metadata: {
        full_name: studentData.fullName,
        role: studentData.role
      }
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: studentData.fullName,
        role: studentData.role
      });

    if (profileError) {
      console.log(`⚠️  Profile error: ${profileError.message}`);
    }

    // Create user_roles entry
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: studentData.role
      });

    if (roleError) {
      console.log(`⚠️  Role error: ${roleError.message}`);
    }

    // Create student record
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .upsert({
        user_id: userId,
        matric_no: studentData.matricNo,
        department: studentData.department,
        faculty: studentData.faculty,
        email: studentData.email,
        phone: studentData.phone,
        organisation_name: studentData.organisationName,
        organisation_address: studentData.organisationAddress,
        nature_of_business: 'Technology Services',
        products_services: 'Software Development',
        location_size: 'medium',
        industry_supervisor_name: studentData.industrySupervisorName,
        industry_supervisor_email: studentData.industrySupervisorEmail,
        industry_supervisor_phone: studentData.industrySupervisorPhone,
        period_of_training: '6 months',
        other_info: 'TEST ACCOUNT - Created for QA testing purposes'
      }, { 
        onConflict: 'user_id' 
      })
      .select()
      .single();

    if (studentError) {
      console.log(`⚠️  Student record error: ${studentError.message}`);
      throw studentError;
    }

    // Create pre-registration record
    const { error: preRegError } = await supabase
      .from('pre_registration')
      .upsert({
        student_id: studentRecord.id,
        session_id: sessionId,
        status: 'pending'
      }, {
        onConflict: 'student_id,session_id'
      });

    if (preRegError) {
      console.log(`⚠️  Pre-registration error: ${preRegError.message}`);
    }

    // Trigger automatic supervisor assignment using the database function
    console.log(`🔄 Triggering automatic supervisor assignment for ${studentData.fullName}...`);
    
    const { data: assignmentResult, error: assignmentError } = await supabase
      .rpc('assign_student_to_school_supervisor', {
        p_student_id: studentRecord.id
      });

    if (assignmentError) {
      console.log(`⚠️  Auto-assignment error: ${assignmentError.message}`);
    } else if (assignmentResult) {
      console.log(`✅ Auto-assigned to supervisor ID: ${assignmentResult}`);
    } else {
      console.log(`⚠️  No supervisor assigned (function returned null)`);
    }

    console.log(`✅ Created student: ${studentData.fullName} (${studentData.email})`);
    
    return {
      success: true,
      userId,
      studentId: studentRecord.id,
      email: studentData.email,
      password: studentData.password,
      name: studentData.fullName,
      matricNo: studentData.matricNo
    };

  } catch (error) {
    console.error(`❌ Failed to create student ${studentData.email}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function verifyAssignments(sessionId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: VERIFYING AUTOMATIC ASSIGNMENTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Query supervisor_assignments table
  const { data: assignments, error: assignError } = await supabase
    .from('supervisor_assignments')
    .select(`
      id,
      student_id,
      supervisor_id,
      session_id,
      assignment_type,
      assigned_at,
      students (
        id,
        matric_no,
        email,
        school_supervisor_name,
        school_supervisor_email
      ),
      supervisors (
        id,
        name,
        email
      )
    `)
    .eq('session_id', sessionId)
    .eq('assignment_type', 'school_supervisor');

  if (assignError) {
    console.log(`⚠️  Could not query supervisor_assignments: ${assignError.message}`);
    
    // Fallback: query students table directly
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('*')
      .like('matric_no', 'TEST/%');

    if (!studentError && students) {
      console.log('\n📊 STUDENT ASSIGNMENTS (from students table):');
      console.log('─'.repeat(100));
      console.log('| Student Name          | Student Email                    | Supervisor Name      | Supervisor Email              |');
      console.log('─'.repeat(100));
      
      for (const student of students) {
        const name = student.full_name || 'N/A';
        const email = student.email || 'N/A';
        const supName = student.school_supervisor_name || 'NOT ASSIGNED';
        const supEmail = student.school_supervisor_email || 'N/A';
        console.log(`| ${name.padEnd(21)} | ${email.padEnd(32)} | ${supName.padEnd(20)} | ${supEmail.padEnd(29)} |`);
      }
      console.log('─'.repeat(100));
    }
    return;
  }

  if (!assignments || assignments.length === 0) {
    console.log('⚠️  No assignments found in supervisor_assignments table.');
    
    // Check students table directly
    const { data: students } = await supabase
      .from('students')
      .select('id, matric_no, email, school_supervisor_name, school_supervisor_email')
      .like('matric_no', 'TEST/%');

    if (students && students.length > 0) {
      console.log('\n📊 STUDENT ASSIGNMENTS (from students table):');
      console.log('─'.repeat(120));
      console.log('| Matric No       | Email                            | Supervisor Name      | Supervisor Email              |');
      console.log('─'.repeat(120));
      
      for (const student of students) {
        console.log(`| ${(student.matric_no || 'N/A').padEnd(15)} | ${(student.email || 'N/A').padEnd(32)} | ${(student.school_supervisor_name || 'NOT ASSIGNED').padEnd(20)} | ${(student.school_supervisor_email || 'N/A').padEnd(29)} |`);
      }
      console.log('─'.repeat(120));
    }
    return;
  }

  console.log('📊 STUDENT-SUPERVISOR ASSIGNMENTS:');
  console.log('═'.repeat(140));
  console.log('| Student Name          | Student Email                    | Assigned Supervisor  | Supervisor Email              | Session ID                           |');
  console.log('─'.repeat(140));
  
  for (const assignment of assignments) {
    const studentName = assignment.students?.matric_no || 'Unknown';
    const studentEmail = assignment.students?.email || 'N/A';
    const supName = assignment.supervisors?.name || 'Unknown';
    const supEmail = assignment.supervisors?.email || 'N/A';
    const sessId = assignment.session_id?.substring(0, 36) || 'N/A';
    
    console.log(`| ${studentName.padEnd(21)} | ${studentEmail.padEnd(32)} | ${supName.padEnd(20)} | ${supEmail.padEnd(29)} | ${sessId} |`);
  }
  console.log('═'.repeat(140));

  // Show distribution
  const supervisorCounts = {};
  for (const a of assignments) {
    const supName = a.supervisors?.name || 'Unknown';
    supervisorCounts[supName] = (supervisorCounts[supName] || 0) + 1;
  }

  console.log('\n📈 SUPERVISOR LOAD DISTRIBUTION:');
  for (const [name, count] of Object.entries(supervisorCounts)) {
    console.log(`   - ${name}: ${count} student(s)`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           MTU SIWES TRACKING SYSTEM - QA TEST ACCOUNT CREATION             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Fix database trigger first
    await fixNotificationTrigger();
    
    // Get or create current session
    console.log('🔍 Checking academic session...');
    const session = await getCurrentSession();
    console.log(`✅ Current Session: ${session.session_name} (ID: ${session.id})`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: CREATE SUPERVISOR ACCOUNTS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: CREATING DUMMY SUPERVISOR ACCOUNTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const supervisor of SUPERVISORS) {
      const result = await createSupervisorAccount(supervisor);
      if (result.success || result.exists) {
        createdSupervisors.push({
          email: supervisor.email,
          password: supervisor.password,
          name: supervisor.fullName,
          ...result
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: CREATE STUDENT ACCOUNTS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: CREATING DUMMY STUDENT ACCOUNTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const student of STUDENTS) {
      const result = await createStudentAccount(student, session.id);
      if (result.success || result.exists) {
        createdStudents.push({
          email: student.email,
          password: student.password,
          name: student.fullName,
          matricNo: student.matricNo,
          ...result
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: VERIFY ASSIGNMENTS
    // ═══════════════════════════════════════════════════════════════════════
    await verifyAssignments(session.id);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: FINAL SUMMARY - LOGIN CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         SUPERVISOR ACCOUNTS                                ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    console.log('║  #  │ Name                 │ Email                              │ Password        ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    
    createdSupervisors.forEach((sup, i) => {
      console.log(`║  ${i+1}  │ ${sup.name.padEnd(20)} │ ${sup.email.padEnd(34)} │ ${sup.password.padEnd(15)} ║`);
    });
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');

    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                          STUDENT ACCOUNTS                                  ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    console.log('║  #  │ Name                 │ Email                              │ Password          ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    
    createdStudents.forEach((stu, i) => {
      console.log(`║  ${i+1}  │ ${stu.name.padEnd(20)} │ ${stu.email.padEnd(34)} │ ${stu.password.padEnd(17)} ║`);
    });
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');

    // Get final assignment state
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    STUDENT SUPERVISOR ASSIGNMENTS                          ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');

    const { data: finalStudents } = await supabase
      .from('students')
      .select('matric_no, email, school_supervisor_name, school_supervisor_email')
      .like('matric_no', 'TEST/%');

    if (finalStudents) {
      finalStudents.forEach((stu, i) => {
        console.log(`║  Student ${i+1}: ${stu.matric_no}`);
        console.log(`║    Email: ${stu.email}`);
        console.log(`║    Assigned To: ${stu.school_supervisor_name || 'NOT ASSIGNED'}`);
        console.log(`║    Supervisor Email: ${stu.school_supervisor_email || 'N/A'}`);
        console.log('║  ─────────────────────────────────────────────────────────────────────────');
      });
    }
    console.log('╚════════════════════════════════════════════════════════════════════════════╝');

    console.log('\n✅ QA TEST ACCOUNT CREATION COMPLETE!');
    console.log('\n📋 QUICK ACCESS:');
    console.log(`   Frontend URL: http://localhost:8080`);
    console.log(`   Supervisor Login: /auth/supervisor`);
    console.log(`   Student Login: /auth/student`);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
