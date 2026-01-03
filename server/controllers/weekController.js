/**
 * Weekly Report Controller
 * Handles weekly logbook submissions and supervisor reviews
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Submit weekly report
 * POST /api/weeks/submit-week
 */
export const submitWeek = async (req, res) => {
  try {
    const {
      studentId,
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

    // Validate required fields
    if (!studentId || !weekNumber) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and week number are required',
      });
    }

    // Validate week number (1-24)
    if (weekNumber < 1 || weekNumber > 24) {
      return res.status(400).json({
        success: false,
        error: 'Week number must be between 1 and 24',
      });
    }

    // Check if week already exists
    const { data: existingWeek } = await supabase
      .from('weeks')
      .select('id, status')
      .eq('student_id', studentId)
      .eq('week_number', weekNumber)
      .single();

    // If week exists and is approved, don't allow editing
    if (existingWeek && existingWeek.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit an approved week',
      });
    }

    const weekData = {
      student_id: studentId,
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
    };

    // Calculate week dates (assuming SIWES starts from a specific date)
    // You may want to get this from student's start_date
    const { data: studentData } = await supabase
      .from('students')
      .select('start_date')
      .eq('id', studentId)
      .single();

    if (studentData?.start_date) {
      const startDate = new Date(studentData.start_date);
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + (weekNumber - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      weekData.start_date = weekStart.toISOString().split('T')[0];
      weekData.end_date = weekEnd.toISOString().split('T')[0];
    }

    let result;
    if (existingWeek) {
      // Update existing week
      const { data, error } = await supabase
        .from('weeks')
        .update(weekData)
        .eq('id', existingWeek.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new week
      const { data, error } = await supabase
        .from('weeks')
        .insert(weekData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({
      success: true,
      message: 'Week submitted successfully',
      data: result,
    });
  } catch (error) {
    console.error('Submit week error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit week',
    });
  }
};

/**
 * Supervisor review week (approve/reject)
 * POST /api/weeks/supervisor/review-week
 */
export const reviewWeek = async (req, res) => {
  try {
    const { weekId, action, comment, grade } = req.body;
    const userId = req.user?.id; // From auth middleware

    if (!weekId || !action) {
      return res.status(400).json({
        success: false,
        error: 'Week ID and action are required',
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "approve" or "reject"',
      });
    }

    // Verify user is a supervisor
    const { data: supervisorData, error: supervisorError } = await supabase
      .from('supervisors')
      .select('id')
      .eq('user_id', userId)
      .eq('supervisor_type', 'school_supervisor')
      .single();

    if (supervisorError || !supervisorData) {
      return res.status(403).json({
        success: false,
        error: 'Only school supervisors can review weeks',
      });
    }

    // Fetch week data
    const { data: weekData, error: weekError } = await supabase
      .from('weeks')
      .select('*')
      .eq('id', weekId)
      .single();

    if (weekError || !weekData) {
      return res.status(404).json({
        success: false,
        error: 'Week not found',
      });
    }

    // Update week status
    const updateData = {
      status: action === 'approve' ? 'approved' : 'rejected',
      school_supervisor_id: supervisorData.id,
      school_supervisor_approved_at: action === 'approve' ? new Date().toISOString() : null,
      supervisor_comment: comment || null,
      supervisor_grade: grade || null,
    };

    const { data: updatedWeek, error: updateError } = await supabase
      .from('weeks')
      .update(updateData)
      .eq('id', weekId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Week ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: updatedWeek,
    });
  } catch (error) {
    console.error('Review week error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to review week',
    });
  }
};




