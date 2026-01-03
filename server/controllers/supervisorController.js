/**
 * Supervisor Controller
 * Handles supervisor operations (viewing students, grading logbooks)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Helper to get supervisor ID from Auth User ID
 */
const getSupervisorId = async (userId) => {
  const { data, error } = await supabase
    .from('supervisors')
    .select('id, supervisor_type')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) return null;
  return data;
};

/**
 * Get Assigned Students
 * GET /api/supervisor/students
 */
export const getAssignedStudents = async (req, res) => {
  try {
    const userId = req.user.id;
    const supervisor = await getSupervisorId(userId);

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor profile not found',
      });
    }

    // Fetch assignments
    const { data: assignments, error } = await supabase
      .from('supervisor_assignments')
      .select(`
        student_id,
        student:students (
          id,
          full_name,
          matric_no,
          department,
          faculty,
          user:profiles(email)
        )
      `)
      .eq('supervisor_id', supervisor.id);

    if (error) throw error;

    // Flatten structure
    const students = assignments.map(a => ({
      ...a.student,
      email: a.student.user?.email
    }));

    res.json({
      success: true,
      data: students,
    });

  } catch (error) {
    console.error('Get assigned students error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned students',
    });
  }
};

/**
 * Get Student Logbook
 * GET /api/supervisor/logbook/:studentId
 */
export const getStudentLogbook = async (req, res) => {
  try {
    const userId = req.user.id;
    const { studentId } = req.params;
    const supervisor = await getSupervisorId(userId);

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor profile not found',
      });
    }

    // Verify assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('supervisor_assignments')
      .select('id')
      .eq('supervisor_id', supervisor.id)
      .eq('student_id', studentId)
      .single();

    if (assignmentError || !assignment) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this student',
      });
    }

    // Fetch logbook
    const { data: weeks, error: weeksError } = await supabase
      .from('weeks')
      .select('*')
      .eq('student_id', studentId)
      .order('week_number', { ascending: true });

    if (weeksError) throw weeksError;

    res.json({
      success: true,
      data: weeks,
    });

  } catch (error) {
    console.error('Get student logbook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student logbook',
    });
  }
};

/**
 * Grade Logbook Week
 * POST /api/supervisor/grade
 */
export const gradeLogbook = async (req, res) => {
  try {
    const userId = req.user.id;
    const { weekId, grade, comments } = req.body;
    const supervisor = await getSupervisorId(userId);

    if (!supervisor) {
      return res.status(404).json({
        success: false,
        error: 'Supervisor profile not found',
      });
    }

    if (!weekId || grade === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Week ID and grade are required',
      });
    }

    // Fetch week to get student_id
    const { data: week, error: weekError } = await supabase
      .from('weeks')
      .select('student_id')
      .eq('id', weekId)
      .single();

    if (weekError || !week) {
      return res.status(404).json({
        success: false,
        error: 'Week entry not found',
      });
    }

    // Verify assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('supervisor_assignments')
      .select('id')
      .eq('supervisor_id', supervisor.id)
      .eq('student_id', week.student_id)
      .single();

    if (assignmentError || !assignment) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this student',
      });
    }

    // Update grade
    const { data: updatedWeek, error: updateError } = await supabase
      .from('weeks')
      .update({
        supervisor_grade: grade,
        supervisor_comment: comments || null,
        school_supervisor_id: supervisor.id,
        school_supervisor_approved_at: new Date().toISOString(),
        status: 'approved' // Assuming grading implies approval
      })
      .eq('id', weekId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      data: updatedWeek,
    });

  } catch (error) {
    console.error('Grade logbook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit grade',
    });
  }
};
