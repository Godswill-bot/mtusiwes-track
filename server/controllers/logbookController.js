/**
 * Logbook Controller
 * Handles student logbook operations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateStudentPDF } from '../lib/pdfGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure PDFs directory exists
const pdfsDir = path.join(__dirname, '../pdfs');
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Helper to get student ID from Auth User ID
 */
const getStudentId = async (userId) => {
  const { data, error } = await supabase
    .from('students')
    .select('id, start_date')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) return null;
  return data;
};

/**
 * Submit Logbook Entry
 * POST /api/logbook/submit
 */
export const submitLogbook = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await getStudentId(userId);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found',
      });
    }

    const {
      weekNumber,
      mondayActivity,
      tuesdayActivity,
      wednesdayActivity,
      thursdayActivity,
      fridayActivity,
      saturdayActivity,
      comments,
      imageUrls,
    } = req.body;

    // Validate week number
    if (!weekNumber || weekNumber < 1 || weekNumber > 24) {
      return res.status(400).json({
        success: false,
        error: 'Valid week number (1-24) is required',
      });
    }

    // Check if week already exists and is approved
    const { data: existingWeek } = await supabase
      .from('weeks')
      .select('id, status')
      .eq('student_id', student.id)
      .eq('week_number', weekNumber)
      .single();

    if (existingWeek && existingWeek.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit an approved week',
      });
    }

    // Calculate dates
    let startDate = null;
    let endDate = null;
    if (student.start_date) {
      const start = new Date(student.start_date);
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      startDate = weekStart.toISOString().split('T')[0];
      endDate = weekEnd.toISOString().split('T')[0];
    }

    const weekData = {
      student_id: student.id,
      week_number: weekNumber,
      monday_activity: mondayActivity || null,
      tuesday_activity: tuesdayActivity || null,
      wednesday_activity: wednesdayActivity || null,
      thursday_activity: thursdayActivity || null,
      friday_activity: fridayActivity || null,
      saturday_activity: saturdayActivity || null,
      comments: comments || null,
      image_urls: imageUrls || [],
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      start_date: startDate,
      end_date: endDate
    };

    let result;
    if (existingWeek) {
      result = await supabase
        .from('weeks')
        .update(weekData)
        .eq('id', existingWeek.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('weeks')
        .insert(weekData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('Submit logbook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit logbook',
    });
  }
};

/**
 * Get My Logbook Entries
 * GET /api/logbook/my
 */
export const getMyLogbook = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await getStudentId(userId);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found',
      });
    }

    const { data: weeks, error } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', student.id)
      .order('week_number', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: weeks,
    });

  } catch (error) {
    console.error('Get logbook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logbook',
    });
  }
};

/**
 * Get My Logbook PDF
 * GET /api/logbook/my/pdf
 */
export const getMyLogbookPDF = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await getStudentId(userId);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found',
      });
    }

    // Fetch full student data for PDF
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*, user:profiles(full_name)') // Assuming profiles relation exists, or just use fields in students
      .eq('id', student.id)
      .single();

    if (studentError) throw studentError;

    // Fetch weeks
    const { data: weeks, error: weeksError } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', student.id)
      .order('week_number', { ascending: true });

    if (weeksError) throw weeksError;

    // Industry supervisor info (from student record)
    const industrySupervisor = {
      name: studentData.industry_supervisor_name || '',
      phone: studentData.industry_supervisor_phone || '',
    };

    // Generate PDF
    const filename = `logbook_${student.id}_${Date.now()}.pdf`;
    const outputPath = path.join(pdfsDir, filename);

    await generateStudentPDF(
      {
        full_name: studentData.user?.full_name || studentData.full_name,
        matric_no: studentData.matric_no,
        department: studentData.department,
        faculty: studentData.faculty,
      },
      weeks,
      industrySupervisor,
      outputPath
    );

    // Stream file
    if (fs.existsSync(outputPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=logbook_${student.id}.pdf`);
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      
      // Optional: Clean up file after sending
      fileStream.on('end', () => {
        // fs.unlinkSync(outputPath); // Uncomment to delete after download
      });
    } else {
      throw new Error('PDF file not found after generation');
    }

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
};
