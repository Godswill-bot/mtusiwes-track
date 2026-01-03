import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ensure exports directory exists
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

/**
 * Download Master List (PDF) - All students with their placement info, supervisors
 */
export const downloadMasterListPDF = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    // Get session info
    const { data: session, error: sessionError } = await supabase
      .from('academic_sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Academic session not found',
      });
    }

    // Get all students with complete info for this session
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        matric_no,
        full_name,
        department,
        faculty,
        email,
        phone,
        organisation_name,
        organisation_address,
        industry_supervisor_name,
        industry_supervisor_phone,
        industry_supervisor_email,
        industry_supervisor_position,
        school_supervisor_name
      `)
      .order('matric_no', { ascending: true });

    if (studentsError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch student data',
      });
    }

    // Get supervisor assignments for additional details
    const { data: assignments } = await supabase
      .from('supervisor_assignments')
      .select(`
        student_id,
        assignment_type,
        supervisor:supervisors(name, email, phone)
      `)
      .eq('session_id', sessionId);

    // Create a map of student assignments
    const assignmentMap = {};
    (assignments || []).forEach(a => {
      if (!assignmentMap[a.student_id]) {
        assignmentMap[a.student_id] = {};
      }
      assignmentMap[a.student_id][a.assignment_type] = a.supervisor;
    });

    // Generate PDF
    const filename = `master_list_${session.session_name}_${Date.now()}.pdf`;
    const outputPath = path.join(exportsDir, filename);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('SIWES Master List', { align: 'center' });
    
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Academic Session: ${session.session_name}`, { align: 'center' })
       .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' })
       .moveDown();

    // Table headers
    const tableTop = doc.y;
    const rowHeight = 18;

    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('S/N', 40, tableTop)
       .text('Matric No', 60, tableTop)
       .text('Student Name', 130, tableTop)
       .text('Department', 230, tableTop)
       .text('Organisation', 310, tableTop)
       .text('Industry Supervisor', 430, tableTop)
       .text('Industry Phone', 540, tableTop)
       .text('School Supervisor', 630, tableTop)
       .text('School Phone', 730, tableTop);

    doc.moveTo(40, tableTop + rowHeight)
       .lineTo(800, tableTop + rowHeight)
       .stroke();

    // Table rows
    let y = tableTop + rowHeight + 3;
    doc.fontSize(7).font('Helvetica');

    students.forEach((student, index) => {
      if (y > 530) {
        doc.addPage();
        y = 50;
      }

      const schoolAssignment = assignmentMap[student.id]?.school_supervisor;
      
      doc.text(String(index + 1), 40, y)
         .text(student.matric_no || 'N/A', 60, y)
         .text((student.full_name || 'N/A').substring(0, 18), 130, y)
         .text((student.department || 'N/A').substring(0, 12), 230, y)
         .text((student.organisation_name || 'N/A').substring(0, 18), 310, y)
         .text((student.industry_supervisor_name || 'N/A').substring(0, 16), 430, y)
         .text((student.industry_supervisor_phone || 'N/A').substring(0, 14), 540, y)
         .text((student.school_supervisor_name || schoolAssignment?.name || 'N/A').substring(0, 14), 630, y)
         .text((schoolAssignment?.phone || 'N/A').substring(0, 14), 730, y);

      y += rowHeight;
    });

    // Summary
    doc.addPage();
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Summary', { align: 'center' })
       .moveDown();

    doc.fontSize(11)
       .font('Helvetica')
       .text(`Total Students: ${students.length}`)
       .text(`Students with Industry Supervisor: ${students.filter(s => s.industry_supervisor_name).length}`)
       .text(`Students with School Supervisor: ${students.filter(s => s.school_supervisor_name).length}`);


    doc.end();

    stream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      fileStream.on('end', () => {
        // Optionally delete file after sending
        setTimeout(() => fs.unlinkSync(outputPath), 5000);
      });
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
};

/**
 * Download Master List (CSV) - Enhanced with all supervisor info
 */
export const downloadMasterListCSV = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const { data: session } = await supabase
      .from('academic_sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    // Get all students with complete info
    const { data: students } = await supabase
      .from('students')
      .select(`
        id,
        matric_no,
        full_name,
        department,
        faculty,
        email,
        phone,
        organisation_name,
        organisation_address,
        industry_supervisor_name,
        industry_supervisor_phone,
        industry_supervisor_email,
        industry_supervisor_position,
        school_supervisor_name
      `)
      .order('matric_no', { ascending: true });

    // Get supervisor assignments
    const { data: assignments } = await supabase
      .from('supervisor_assignments')
      .select(`
        student_id,
        assignment_type,
        supervisor:supervisors(name, email, phone)
      `)
      .eq('session_id', sessionId);

    // Create a map of student assignments
    const assignmentMap = {};
    (assignments || []).forEach(a => {
      if (!assignmentMap[a.student_id]) {
        assignmentMap[a.student_id] = {};
      }
      assignmentMap[a.student_id][a.assignment_type] = a.supervisor;
    });

    // Generate CSV with comprehensive headers
    const headers = [
      'S/N', 'Matric No', 'Student Name', 'Department', 'Faculty', 
      'Student Email', 'Student Phone',
      'Organisation Name', 'Organisation Address',
      'Industry Supervisor Name', 'Industry Supervisor Phone', 
      'Industry Supervisor Email', 'Industry Supervisor Position',
      'School Supervisor Name', 'School Supervisor Email', 'School Supervisor Phone'
    ];

    const rows = (students || []).map((s, index) => {
      const schoolAssignment = assignmentMap[s.id]?.school_supervisor;
      return [
        index + 1,
        s.matric_no || '',
        s.full_name || '',
        s.department || '',
        s.faculty || '',
        s.email || '',
        s.phone || '',
        s.organisation_name || '',
        s.organisation_address || '',
        s.industry_supervisor_name || '',
        s.industry_supervisor_phone || '',
        s.industry_supervisor_email || '',
        s.industry_supervisor_position || '',
        s.school_supervisor_name || schoolAssignment?.name || '',
        schoolAssignment?.email || '',
        schoolAssignment?.phone || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="master_list_${session?.session_name}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSV',
    });
  }
};

/**
 * Download Placement List (PDF)
 */
export const downloadPlacementListPDF = async (req, res) => {
  // Similar to master list but focused on placements only
  return downloadMasterListPDF(req, res);
};

/**
 * Download Placement List (CSV)
 */
export const downloadPlacementListCSV = async (req, res) => {
  // Similar to master list CSV
  return downloadMasterListCSV(req, res);
};

/**
 * Download Supervisor Assignments (PDF)
 */
export const downloadSupervisorAssignmentsPDF = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const { data: session } = await supabase
      .from('academic_sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    const { data: assignments } = await supabase
      .from('supervisor_assignments')
      .select(`
        *,
        supervisor:supervisors(name, email, phone, supervisor_type),
        student:students(matric_no, full_name, department)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const filename = `supervisor_assignments_${session?.session_name}_${Date.now()}.pdf`;
    const outputPath = path.join(exportsDir, filename);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('Supervisor Assignments', { align: 'center' });
    
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Academic Session: ${session?.session_name}`, { align: 'center' })
       .moveDown();

    const tableTop = doc.y;
    const rowHeight = 20;
    
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Supervisor', 50, tableTop)
       .text('Type', 200, tableTop)
       .text('Student', 280, tableTop)
       .text('Department', 420, tableTop);

    doc.moveTo(50, tableTop + rowHeight)
       .lineTo(550, tableTop + rowHeight)
       .stroke();

    let y = tableTop + rowHeight + 5;
    doc.fontSize(9).font('Helvetica');

    assignments.forEach(assignment => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      const supervisor = assignment.supervisor;
      const student = assignment.student;
      
      doc.text(supervisor?.name || 'N/A', 50, y)
         .text(assignment.assignment_type.replace('_', ' '), 200, y)
         .text(`${student?.matric_no || ''} - ${student?.full_name || 'N/A'}`, 280, y)
         .text(student?.department || 'N/A', 420, y);

      y += rowHeight;
    });

    doc.end();

    stream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      fileStream.on('end', () => {
        setTimeout(() => fs.unlinkSync(outputPath), 5000);
      });
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
};

/**
 * Download Supervisor Assignments (CSV)
 */
export const downloadSupervisorAssignmentsCSV = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const { data: session } = await supabase
      .from('academic_sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    const { data: assignments } = await supabase
      .from('supervisor_assignments')
      .select(`
        *,
        supervisor:supervisors(name, email, phone, supervisor_type),
        student:students(matric_no, full_name, department)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const headers = ['Supervisor Name', 'Supervisor Email', 'Supervisor Type', 'Student Matric', 'Student Name', 'Department', 'Assignment Type', 'Assigned Date'];
    const rows = assignments.map(a => [
      a.supervisor?.name || '',
      a.supervisor?.email || '',
      a.supervisor?.supervisor_type || '',
      a.student?.matric_no || '',
      a.student?.full_name || '',
      a.student?.department || '',
      a.assignment_type,
      new Date(a.assigned_at).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="supervisor_assignments_${session?.session_name}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSV',
    });
  }
};

/**
 * Get All Users (Paginated)
 * GET /api/admin/users
 */
export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const role = req.query.role; // Optional filter

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
};

/**
 * Get All Logbooks (Paginated)
 * GET /api/admin/logbooks
 */
export const getLogbooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Optional filter

    let query = supabase
      .from('weeks')
      .select(`
        *,
        student:students (
          full_name,
          matric_no
        )
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: logbooks, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: logbooks,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });

  } catch (error) {
    console.error('Get logbooks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logbooks',
    });
  }
};

/**
 * Get System Reports
 * GET /api/admin/reports
 */
export const getReports = async (req, res) => {
  try {
    // Aggregate stats
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { count: totalSupervisors } = await supabase
      .from('supervisors')
      .select('*', { count: 'exact', head: true });

    const { count: totalSubmissions } = await supabase
      .from('weeks')
      .select('*', { count: 'exact', head: true });

    const { count: pendingReviews } = await supabase
      .from('weeks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted');

    res.json({
      success: true,
      data: {
        totalStudents: totalStudents || 0,
        totalSupervisors: totalSupervisors || 0,
        totalSubmissions: totalSubmissions || 0,
        pendingReviews: pendingReviews || 0,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
    });
  }
};

/**
 * Get All Students
 * GET /api/admin/students
 */
export const getStudents = async (req, res) => {
  try {
    const { sessionId } = req.query;
    let query = supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (sessionId) {
      query = query.eq('placement_session_id', sessionId);
    }

    const { data: students, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students',
    });
  }
};

/**
 * Get All Supervisors
 * GET /api/admin/supervisors
 */
export const getSupervisors = async (req, res) => {
  try {
    const { data: supervisors, error } = await supabase
      .from('supervisors')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: supervisors,
    });
  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supervisors',
    });
  }
};

/**
 * Download Weekly Reports (PDF) - All weekly reports with grades for a session
 */
export const downloadWeeklyReportsPDF = async (req, res) => {
  try {
    const { sessionId, status } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    // Get session info
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    // Build query for weekly reports
    let query = supabase
      .from('weeks')
      .select(`
        *,
        student:students(
          matric_no,
          full_name,
          department,
          faculty,
          organisation_name,
          school_supervisor_name
        )
      `)
      .order('student_id', { ascending: true })
      .order('week_number', { ascending: true });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: weeklyReports, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch weekly reports',
      });
    }

    // Generate PDF
    const filename = `weekly_reports_${session?.session_name || 'all'}_${Date.now()}.pdf`;
    const outputPath = path.join(exportsDir, filename);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('SIWES Weekly Reports Summary', { align: 'center' });
    
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Academic Session: ${session?.session_name || 'All Sessions'}`, { align: 'center' })
       .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' })
       .moveDown();

    // Table headers
    const tableTop = doc.y;
    const rowHeight = 18;

    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('Matric No', 50, tableTop)
       .text('Student Name', 120, tableTop)
       .text('Week', 240, tableTop)
       .text('Status', 280, tableTop)
       .text('Score', 340, tableTop)
       .text('Supervisor Comments', 380, tableTop)
       .text('Submitted', 500, tableTop);

    doc.moveTo(50, tableTop + rowHeight)
       .lineTo(550, tableTop + rowHeight)
       .stroke();

    // Table rows
    let y = tableTop + rowHeight + 3;
    doc.fontSize(8).font('Helvetica');

    weeklyReports.forEach((report) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }

      const student = report.student;
      doc.text(student?.matric_no || 'N/A', 50, y)
         .text((student?.full_name || 'N/A').substring(0, 18), 120, y)
         .text(`Wk ${report.week_number}`, 240, y)
         .text(report.status || 'N/A', 280, y)
         .text(report.score !== null ? `${report.score}/100` : 'N/A', 340, y)
         .text((report.school_supervisor_comments || '').substring(0, 20), 380, y)
         .text(report.submitted_at ? new Date(report.submitted_at).toLocaleDateString() : 'N/A', 500, y);

      y += rowHeight;
    });

    // Summary section
    doc.addPage();
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Summary Statistics', { align: 'center' })
       .moveDown();

    const totalReports = weeklyReports.length;
    const approvedReports = weeklyReports.filter(r => r.status === 'approved').length;
    const gradedReports = weeklyReports.filter(r => r.score !== null).length;
    const avgScore = gradedReports > 0 
      ? weeklyReports.filter(r => r.score !== null).reduce((sum, r) => sum + r.score, 0) / gradedReports 
      : 0;

    doc.fontSize(11)
       .font('Helvetica')
       .text(`Total Reports: ${totalReports}`)
       .text(`Approved Reports: ${approvedReports}`)
       .text(`Graded Reports: ${gradedReports}`)
       .text(`Average Score: ${avgScore.toFixed(1)}/100`);

    doc.end();

    stream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      fileStream.on('end', () => {
        setTimeout(() => fs.unlinkSync(outputPath), 5000);
      });
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
};

/**
 * Download Weekly Reports (CSV)
 */
export const downloadWeeklyReportsCSV = async (req, res) => {
  try {
    const { sessionId, status } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const { data: session } = await supabase
      .from('academic_sessions')
      .select('session_name')
      .eq('id', sessionId)
      .single();

    // Build query for weekly reports
    let query = supabase
      .from('weeks')
      .select(`
        *,
        student:students(
          matric_no,
          full_name,
          department,
          faculty,
          organisation_name,
          school_supervisor_name
        )
      `)
      .order('student_id', { ascending: true })
      .order('week_number', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: weeklyReports } = await query;

    const headers = [
      'Matric No', 'Student Name', 'Department', 'Organisation',
      'Week Number', 'Start Date', 'End Date', 'Status', 'Score',
      'Monday Activity', 'Tuesday Activity', 'Wednesday Activity',
      'Thursday Activity', 'Friday Activity', 'Saturday Activity',
      'Student Comments', 'School Supervisor Comments', 'Industry Supervisor Comments',
      'Submitted At', 'School Approved At'
    ];

    const rows = weeklyReports.map(r => [
      r.student?.matric_no || '',
      r.student?.full_name || '',
      r.student?.department || '',
      r.student?.organisation_name || '',
      r.week_number,
      r.start_date,
      r.end_date,
      r.status,
      r.score !== null ? r.score : '',
      r.monday_activity || '',
      r.tuesday_activity || '',
      r.wednesday_activity || '',
      r.thursday_activity || '',
      r.friday_activity || '',
      r.saturday_activity || '',
      r.comments || '',
      r.school_supervisor_comments || '',
      r.industry_supervisor_comments || '',
      r.submitted_at || '',
      r.school_supervisor_approved_at || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="weekly_reports_${session?.session_name}_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSV',
    });
  }
};

/**
 * Download Full Logbook for a Student (PDF)
 */
export const downloadStudentLogbookPDF = async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
    }

    // Get student info
    const { data: student } = await supabase
      .from('students')
      .select(`
        *,
        supervisor_assignments(
          supervisor:supervisors(name, email, phone)
        )
      `)
      .eq('id', studentId)
      .single();

    // Get all weeks for the student
    const { data: weeks } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', studentId)
      .order('week_number', { ascending: true });

    // Get stamps
    const { data: stamps } = await supabase
      .from('stamps')
      .select('*')
      .in('week_id', weeks?.map(w => w.id) || []);

    // Generate comprehensive PDF
    const filename = `logbook_${student?.matric_no || studentId}_${Date.now()}.pdf`;
    const outputPath = path.join(exportsDir, filename);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Cover page
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text('SIWES LOGBOOK', { align: 'center' })
       .moveDown(2);

    doc.fontSize(14)
       .font('Helvetica')
       .text(`Student Name: ${student?.full_name || 'N/A'}`, { align: 'center' })
       .text(`Matric No: ${student?.matric_no || 'N/A'}`, { align: 'center' })
       .text(`Department: ${student?.department || 'N/A'}`, { align: 'center' })
       .text(`Faculty: ${student?.faculty || 'N/A'}`, { align: 'center' })
       .moveDown()
       .text(`Organisation: ${student?.organisation_name || 'N/A'}`, { align: 'center' })
       .text(`Address: ${student?.organisation_address || 'N/A'}`, { align: 'center' })
       .moveDown()
       .text(`School Supervisor: ${student?.school_supervisor_name || 'N/A'}`, { align: 'center' })
       .text(`Industry Supervisor: ${student?.industry_supervisor_name || 'N/A'}`, { align: 'center' })
       .moveDown(2);

    doc.fontSize(10)
       .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

    // Weekly entries
    (weeks || []).forEach((week, index) => {
      doc.addPage();
      
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text(`Week ${week.week_number}`, { align: 'center' })
         .fontSize(10)
         .font('Helvetica')
         .text(`${week.start_date} - ${week.end_date}`, { align: 'center' })
         .moveDown();

      // Status and score
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Status: ${week.status || 'Draft'}`)
         .text(`Score: ${week.score !== null ? `${week.score}/100` : 'Not graded'}`)
         .moveDown();

      // Daily activities
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      days.forEach(day => {
        const activity = week[`${day}_activity`];
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text(`${day.charAt(0).toUpperCase() + day.slice(1)}:`, { continued: false });
        doc.fontSize(10)
           .font('Helvetica')
           .text(activity || 'No activity logged')
           .moveDown(0.5);
      });

      // Comments
      if (week.comments) {
        doc.moveDown()
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Student Comments:')
           .fontSize(10)
           .font('Helvetica')
           .text(week.comments);
      }

      if (week.school_supervisor_comments) {
        doc.moveDown()
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('School Supervisor Comments:')
           .fontSize(10)
           .font('Helvetica')
           .text(week.school_supervisor_comments);
      }

      if (week.industry_supervisor_comments) {
        doc.moveDown()
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Industry Supervisor Comments:')
           .fontSize(10)
           .font('Helvetica')
           .text(week.industry_supervisor_comments);
      }

      // Approval info
      doc.moveDown();
      if (week.school_supervisor_approved_at) {
        doc.fontSize(9)
           .text(`School Supervisor Approved: ${new Date(week.school_supervisor_approved_at).toLocaleDateString()}`);
      }
      if (week.industry_supervisor_approved_at) {
        doc.fontSize(9)
           .text(`Industry Supervisor Approved: ${new Date(week.industry_supervisor_approved_at).toLocaleDateString()}`);
      }
    });

    doc.end();

    stream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      fileStream.on('end', () => {
        setTimeout(() => fs.unlinkSync(outputPath), 5000);
      });
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
};














