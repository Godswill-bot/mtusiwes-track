/**
 * PDF Generation Controller
 * Handles PDF generation for student summaries and supervisor grading
 */

import { generateStudentPDF, generateSupervisorPDF, generateWeeklyReportPDF, generateLogbookPDF } from '../lib/pdfGenerator.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ensure PDFs directory exists
const pdfsDir = path.join(__dirname, '../pdfs');
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
}

/**
 * Generate Student 24-Week Summary PDF
 * POST /api/pdf/generate-student-pdf
 */
export const generateStudentSummaryPDF = async (req, res) => {
  try {
    const { studentId } = req.body;
    const userId = req.user?.id; // From auth middleware

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
    }

    // Fetch student data
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    // Verify user owns this student record or is supervisor
    if (userId && studentData.user_id !== userId) {
      // Check if user is supervisor
      const { data: supervisorData } = await supabase
        .from('supervisors')
        .select('id')
        .eq('user_id', userId)
        .eq('supervisor_type', 'school_supervisor')
        .single();

      if (!supervisorData) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized',
        });
      }
    }

    // Fetch all 24 weeks
    const { data: weeksData, error: weeksError } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', studentId)
      .lte('week_number', 24)
      .order('week_number', { ascending: true });

    if (weeksError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch weekly reports',
      });
    }

    if (!weeksData || weeksData.length < 24) {
      return res.status(400).json({
        success: false,
        error: 'Student must complete all 24 weeks before generating PDF',
      });
    }

    // Check if all 24 weeks are approved
    const approvedWeeks = weeksData.filter(w => w.status === 'approved').length;
    if (approvedWeeks < 24) {
      return res.status(400).json({
        success: false,
        error: `Student must have all 24 weeks approved. Currently ${approvedWeeks}/24 approved.`,
      });
    }

    // Industry supervisor info (from student record)
    const industrySupervisor = {
      name: studentData.industry_supervisor_name || '',
      phone: studentData.industry_supervisor_phone || '',
    };

    // Generate PDF
    const filename = `student_summary_${studentId}_${Date.now()}.pdf`;
    const outputPath = path.join(pdfsDir, filename);

    await generateStudentPDF(
      {
        full_name: studentData.user?.full_name || studentData.full_name,
        matric_no: studentData.matric_no,
        department: studentData.department,
        faculty: studentData.faculty,
      },
      weeksData,
      industrySupervisor,
      outputPath
    );

    // Update student record
    await supabase
      .from('students')
      .update({
        student_pdf_generated: true,
        student_pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    // Clean up file after sending (optional, or keep for records)
    fileStream.on('end', () => {
      // Optionally delete after 24 hours or keep for records
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
 * Generate Supervisor Grading PDF
 * POST /api/pdf/generate-supervisor-pdf
 */
export const generateSupervisorGradingPDF = async (req, res) => {
  try {
    const { studentId } = req.body;
    const userId = req.user?.id; // From auth middleware

    console.log('[PDF] Generate supervisor grading PDF request:', { studentId, userId });

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
    }

    // Verify user is a supervisor
    const { data: supervisorData, error: supervisorError } = await supabase
      .from('supervisors')
      .select('*')
      .eq('user_id', userId)
      .eq('supervisor_type', 'school_supervisor')
      .single();

    if (supervisorError || !supervisorData) {
      console.log('[PDF] Supervisor check failed:', supervisorError?.message || 'Not a school supervisor');
      return res.status(403).json({
        success: false,
        error: 'Only school supervisors can generate grading PDFs',
      });
    }

    // Debug log for studentId
    console.log('[PDF] compileLogbook called with studentId:', studentId);
    // Fetch student data - use separate query for profile to avoid join issues
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      console.log('[PDF] Student fetch failed:', studentError?.message, 'studentId:', studentId, 'studentData:', studentData);
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    // Get profile name separately
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', studentData.user_id)
      .single();

    // Merge profile data
    studentData.user = profileData || { full_name: studentData.full_name || 'Unknown Student' };

    // Verify supervisor is assigned to this student
    // (Add your assignment logic here - could be by department, explicit assignment, etc.)

    // Fetch all weeks
    const { data: weeksData, error: weeksError } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', studentId)
      .order('week_number', { ascending: true });

    if (weeksError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch weekly reports',
      });
    }

    // Fetch grading data
    const { data: gradeData, error: gradeError } = await supabase
      .from('supervisor_grades')
      .select('*')
      .eq('student_id', studentId)
      .eq('supervisor_id', supervisorData.id)
      .single();

    if (gradeError || !gradeData) {
      return res.status(400).json({
        success: false,
        error: 'Please grade the student first before generating PDF',
      });
    }

    // Generate PDF
    const filename = `supervisor_grading_${studentId}_${supervisorData.id}_${Date.now()}.pdf`;
    const outputPath = path.join(pdfsDir, filename);

    await generateSupervisorPDF(
      {
        name: supervisorData.name,
        email: supervisorData.email,
      },
      {
        full_name: studentData.user?.full_name || studentData.full_name,
        matric_no: studentData.matric_no,
        department: studentData.department,
        profile_image_url: studentData.profile_image_url || null, // Include profile picture URL
      },
      weeksData,
      {
        grade: gradeData.grade,
        score: gradeData.score,
        remarks: gradeData.remarks,
      },
      outputPath
    );

    // Update grade record
    await supabase
      .from('supervisor_grades')
      .update({
        pdf_generated: true,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq('id', gradeData.id);

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
};

/**
 * Generate Individual Weekly Report PDF
 * POST /api/pdf/generate-week-pdf
 */
export const generateWeekPDF = async (req, res) => {
  try {
    const { weekId } = req.body;
    const userId = req.user?.id;

    if (!weekId) {
      return res.status(400).json({
        success: false,
        error: 'Week ID is required',
      });
    }

    // Fetch week data with student info
    const { data: weekData, error: weekError } = await supabase
      .from('weeks')
      .select(`
        *,
        student:students(
          id,
          matric_no,
          department,
          faculty,
          organisation_name,
          full_name,
          user_id
        )
      `)
      .eq('id', weekId)
      .single();

    if (weekError || !weekData) {
      return res.status(404).json({
        success: false,
        error: 'Week not found',
      });
    }

    // Get student's full name from profiles if needed
    let studentFullName = weekData.student?.full_name;
    if (!studentFullName && weekData.student?.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', weekData.student.user_id)
        .single();
      studentFullName = profileData?.full_name;
    }

    // Fetch stamps/signatures for this week
    const { data: stamps } = await supabase
      .from('stamps')
      .select('id, week_id, method, image_path, signed_at')
      .eq('week_id', weekId);

    // Generate PDF
    const filename = `week_${weekData.week_number}_report_${weekId}_${Date.now()}.pdf`;
    const outputPath = path.join(pdfsDir, filename);

    await generateWeeklyReportPDF(
      weekData,
      {
        full_name: studentFullName || 'Unknown',
        matric_no: weekData.student?.matric_no || 'N/A',
        department: weekData.student?.department || 'N/A',
        organisation_name: weekData.student?.organisation_name || 'N/A',
      },
      weekData.image_urls || [],
      stamps || [],
      outputPath
    );

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Week_${weekData.week_number}_Report.pdf"`);
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      // Delete after streaming
      setTimeout(() => {
        try {
          fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Weekly PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly report PDF',
    });
  }
};
/**
 * Compile Complete Logbook PDF (24 Weeks)
 * POST /api/pdf/compile-logbook
 * Combines all weeks into a single comprehensive PDF
 */
export const compileLogbook = async (req, res) => {

  try {
    const { studentId } = req.body;
    const userId = req.user?.id;
    console.log('[PDF] compileLogbook called with studentId:', studentId);
    console.log('[DEBUG] compileLogbook called with studentId:', studentId);

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
    }

    // Fetch student data

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();
    console.log('[DEBUG] studentData:', studentData, 'studentError:', studentError);

    if (studentError || !studentData) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    // Fetch ALL weeks for this student (regardless of status)
    const { data: weeksData, error: weeksError } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', studentId)
      .order('week_number', { ascending: true });

    if (weeksError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch weekly reports',
      });
    }

    if (!weeksData || weeksData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No weekly reports found for this student',
      });
    }

    // Fetch stamps for all weeks
    const weekIds = weeksData.map(w => w.id);
    const { data: stampsData } = await supabase
      .from('stamps')
      .select('*')
      .in('week_id', weekIds);

    // Attach stamps to their respective weeks
    const weeksWithStamps = weeksData.map(week => ({
      ...week,
      stamps: stampsData?.filter(s => s.week_id === week.id) || []
    }));

    // Industry supervisor info from student record
    const industrySupervisor = {
      name: studentData.industry_supervisor_name || '',
      email: studentData.industry_supervisor_email || '',
      phone: studentData.industry_supervisor_phone || '',
    };

    // Get student full name from profiles or student record
    const studentFullName = studentData.user?.full_name || studentData.full_name || 'Unknown';

    // Generate PDF
    const filename = `logbook_${studentData.matric_no || studentId}_${Date.now()}.pdf`;
    const outputPath = path.join(pdfsDir, filename);

    await generateLogbookPDF(
      {
        full_name: studentFullName,
        matric_no: studentData.matric_no,
        department: studentData.department,
        faculty: studentData.faculty,
        level: studentData.level,
        organisation_name: studentData.organisation_name,
        period_of_training: studentData.period_of_training,
      },
      weeksWithStamps,
      industrySupervisor,
      outputPath
    );

    // Update student record to mark logbook as compiled
    await supabase
      .from('students')
      .update({
        logbook_compiled: true,
        logbook_compiled_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SIWES_Logbook_${studentData.matric_no || 'Student'}.pdf"`);
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    // Clean up file after sending
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);
    });
  } catch (error) {
    console.error('Logbook compilation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compile logbook PDF',
    });
  }
};

/**
 * Generate Attendance PDF for a student
 * GET /api/pdf/attendance/:studentId
 */
export const generateAttendancePDF = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
    }

    // Fetch student data with profile
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*, user:profiles(full_name)')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    // Fetch all attendance records
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .order('date', { ascending: true });

    if (attendanceError) {
      throw attendanceError;
    }

    // Import PDFKit
    const { default: PDFDocument } = await import('pdfkit');

    // Create PDF
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      bufferPages: true 
    });

    // Set response headers
    const studentName = studentData.user?.full_name || studentData.full_name || 'Unknown';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Attendance_${studentName.replace(/\s+/g, '_')}.pdf"`);

    // Pipe to response
    doc.pipe(res);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('SIWES ATTENDANCE RECORD', { align: 'center' });
    doc.moveDown();

    // Student info header
    doc.fontSize(12).font('Helvetica-Bold');
    doc.rect(50, doc.y, 495, 100).stroke();
    const infoStartY = doc.y + 10;
    
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Student Name:', 60, infoStartY);
    doc.font('Helvetica').text(studentName, 160, infoStartY);
    
    doc.font('Helvetica-Bold').text('Matric Number:', 60, infoStartY + 18);
    doc.font('Helvetica').text(studentData.matric_no || 'N/A', 160, infoStartY + 18);
    
    doc.font('Helvetica-Bold').text('Department:', 60, infoStartY + 36);
    doc.font('Helvetica').text(studentData.department || 'N/A', 160, infoStartY + 36);
    
    doc.font('Helvetica-Bold').text('Level:', 300, infoStartY);
    doc.font('Helvetica').text(studentData.level || 'N/A', 350, infoStartY);
    
    doc.font('Helvetica-Bold').text('Organisation:', 300, infoStartY + 18);
    doc.font('Helvetica').text(studentData.organisation_name || 'N/A', 380, infoStartY + 18, { width: 165 });
    
    doc.font('Helvetica-Bold').text('Training Period:', 300, infoStartY + 36);
    doc.font('Helvetica').text(studentData.period_of_training || 'N/A', 400, infoStartY + 36);

    doc.moveDown(5);

    // Summary statistics
    const totalDays = attendanceData?.length || 0;
    const completeDays = attendanceData?.filter(a => a.check_in_time && a.check_out_time).length || 0;
    
    // Calculate total hours
    let totalHours = 0;
    (attendanceData || []).forEach(record => {
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(`1970-01-01T${record.check_in_time}`);
        const checkOut = new Date(`1970-01-01T${record.check_out_time}`);
        const hours = (checkOut - checkIn) / (1000 * 60 * 60);
        if (hours > 0) totalHours += hours;
      }
    });

    doc.fontSize(12).font('Helvetica-Bold').text('ATTENDANCE SUMMARY', { align: 'center' });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Check-ins: ${totalDays}     Complete Days: ${completeDays}     Total Hours: ${Math.round(totalHours * 10) / 10}h`, { align: 'center' });
    doc.moveDown();

    // Table header
    const tableTop = doc.y + 10;
    const col1 = 50;
    const col2 = 180;
    const col3 = 280;
    const col4 = 370;
    const col5 = 470;
    
    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(50, tableTop - 5, 495, 20).fill('#f0f0f0').stroke();
    doc.fillColor('black');
    doc.text('DATE', col1 + 5, tableTop);
    doc.text('CHECK-IN', col2 + 5, tableTop);
    doc.text('CHECK-OUT', col3 + 5, tableTop);
    doc.text('HOURS', col4 + 5, tableTop);
    doc.text('STATUS', col5 - 10, tableTop);

    // Table rows
    let rowY = tableTop + 20;
    const rowHeight = 20;
    doc.font('Helvetica').fontSize(9);

    if (!attendanceData || attendanceData.length === 0) {
      doc.text('No attendance records found', col1 + 5, rowY);
    } else {
      attendanceData.forEach((record, index) => {
        // Check if we need a new page
        if (rowY > 750) {
          doc.addPage();
          rowY = 50;
          
          // Redraw header on new page
          doc.fontSize(10).font('Helvetica-Bold');
          doc.rect(50, rowY - 5, 495, 20).fill('#f0f0f0').stroke();
          doc.fillColor('black');
          doc.text('DATE', col1 + 5, rowY);
          doc.text('CHECK-IN', col2 + 5, rowY);
          doc.text('CHECK-OUT', col3 + 5, rowY);
          doc.text('HOURS', col4 + 5, rowY);
          doc.text('STATUS', col5 - 10, rowY);
          rowY += 20;
          doc.font('Helvetica').fontSize(9);
        }

        // Alternating row colors
        if (index % 2 === 1) {
          doc.rect(50, rowY - 3, 495, rowHeight).fill('#fafafa').stroke();
          doc.fillColor('black');
        }

        // Format date
        const date = new Date(record.date);
        const formattedDate = date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });

        // Calculate hours for this record
        let hoursWorked = 'N/A';
        if (record.check_in_time && record.check_out_time) {
          const checkIn = new Date(`1970-01-01T${record.check_in_time}`);
          const checkOut = new Date(`1970-01-01T${record.check_out_time}`);
          const hours = (checkOut - checkIn) / (1000 * 60 * 60);
          if (hours > 0) {
            const h = Math.floor(hours);
            const m = Math.round((hours - h) * 60);
            hoursWorked = `${h}h ${m}m`;
          }
        }

        // Status
        const status = record.check_in_time && record.check_out_time ? 'Complete' : 
                       record.check_in_time ? 'Partial' : 'Absent';

        doc.text(formattedDate, col1 + 5, rowY);
        doc.text(record.check_in_time || '-', col2 + 5, rowY);
        doc.text(record.check_out_time || '-', col3 + 5, rowY);
        doc.text(hoursWorked, col4 + 5, rowY);
        doc.text(status, col5 - 10, rowY);

        rowY += rowHeight;
      });
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text('Digital SIWES Tracking System - MTU', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Attendance PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate attendance PDF',
    });
  }
};