/**
 * Grading Controller
 * Handles supervisor grading of students using Rule-Based 30-Point System
 * 
 * Grading Structure (STRICT):
 * - Attendance → 10 marks (based on daily check-ins)
 * - Weekly Reports → 15 marks (based on submitted weeks)
 * - Supervisor Approval → 5 marks (based on approved weeks)
 * TOTAL = 30 marks (must never exceed 30)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Constants for grading
const MAX_ATTENDANCE_SCORE = 10;
const MAX_WEEKLY_REPORTS_SCORE = 15;
const MAX_SUPERVISOR_APPROVAL_SCORE = 5;
const MAX_TOTAL_SCORE = 30;
const MAX_WEEKS = 24;
const WORKING_DAYS_PER_WEEK = 6;
const MAX_EXPECTED_ATTENDANCE_DAYS = MAX_WEEKS * WORKING_DAYS_PER_WEEK; // 144 days

/**
 * Convert 30-point score to grade letter
 * @param {number} score - Score (0-30)
 * @returns {string} - Grade letter (A, B, C, D, F)
 */
const scoreToGrade = (score) => {
  if (score >= 25) return 'A';  // 83%+
  if (score >= 20) return 'B';  // 67%+
  if (score >= 15) return 'C';  // 50%+
  if (score >= 12) return 'D';  // 40%+
  return 'F';
};

/**
 * Calculate attendance score (max 10 marks)
 * Based on check-ins during 24-week period
 */
const calculateAttendanceScore = async (studentId) => {
  const { data: attendanceData, error } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', studentId)
    .not('check_in_time', 'is', null);

  if (error) {
    console.error('Attendance fetch error:', error);
    return 0;
  }

  const totalCheckIns = attendanceData?.length || 0;
  
  // Calculate proportionally (10 marks max)
  const score = Math.min(MAX_ATTENDANCE_SCORE, (totalCheckIns / MAX_EXPECTED_ATTENDANCE_DAYS) * MAX_ATTENDANCE_SCORE);
  return Math.round(score * 100) / 100;
};

/**
 * Calculate weekly reports score (max 15 marks)
 * Based on submitted weeks out of 24
 */
const calculateWeeklyReportsScore = async (studentId) => {
  const { data: weeksData, error } = await supabase
    .from('weeks')
    .select('id, status')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'approved']);

  if (error) {
    console.error('Weeks fetch error:', error);
    return 0;
  }

  const submittedWeeks = weeksData?.length || 0;
  
  // Calculate proportionally (15 marks max)
  const score = Math.min(MAX_WEEKLY_REPORTS_SCORE, (submittedWeeks / MAX_WEEKS) * MAX_WEEKLY_REPORTS_SCORE);
  return Math.round(score * 100) / 100;
};

/**
 * Calculate supervisor approval score (max 5 marks)
 * Based on approved weeks out of total submitted
 */
const calculateSupervisorApprovalScore = async (studentId) => {
  const { data: allWeeksData, error: allError } = await supabase
    .from('weeks')
    .select('id, status')
    .eq('student_id', studentId)
    .in('status', ['submitted', 'approved']);

  if (allError) {
    console.error('Weeks fetch error:', allError);
    return 0;
  }

  const submittedWeeks = allWeeksData?.length || 0;
  const approvedWeeks = allWeeksData?.filter(w => w.status === 'approved').length || 0;

  if (submittedWeeks === 0) return 0;

  // Calculate proportionally (5 marks max)
  const score = Math.min(MAX_SUPERVISOR_APPROVAL_SCORE, (approvedWeeks / submittedWeeks) * MAX_SUPERVISOR_APPROVAL_SCORE);
  return Math.round(score * 100) / 100;
};

/**
 * Calculate complete grade breakdown for a student
 */
const calculateGradeBreakdown = async (studentId) => {
  const attendanceScore = await calculateAttendanceScore(studentId);
  const weeklyReportsScore = await calculateWeeklyReportsScore(studentId);
  const supervisorApprovalScore = await calculateSupervisorApprovalScore(studentId);
  
  const totalScore = Math.min(MAX_TOTAL_SCORE, attendanceScore + weeklyReportsScore + supervisorApprovalScore);
  const grade = scoreToGrade(totalScore);

  return {
    attendanceScore,
    weeklyReportsScore,
    supervisorApprovalScore,
    totalScore: Math.round(totalScore * 100) / 100,
    grade,
  };
};

/**
 * Submit supervisor grade (Rule-Based 30-Point System)
 * POST /api/grading/submit-grade
 * 
 * Auto-calculates scores based on:
 * - Attendance (10 marks)
 * - Weekly Reports (15 marks)
 * - Supervisor Approval (5 marks)
 * 
 * Supervisor can optionally override the weekly_reports_score
 */
export const submitGrade = async (req, res) => {
  try {
    const { studentId, weeklyReportsOverride, remarks } = req.body;
    const userId = req.user?.id;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
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
        error: 'Only school supervisors can grade students',
      });
    }

    // Auto-calculate the grade breakdown
    const gradeBreakdown = await calculateGradeBreakdown(studentId);
    
    // Allow supervisor to override weekly reports score (within limit)
    let finalWeeklyReportsScore = gradeBreakdown.weeklyReportsScore;
    if (weeklyReportsOverride !== undefined && weeklyReportsOverride !== null) {
      if (weeklyReportsOverride < 0 || weeklyReportsOverride > MAX_WEEKLY_REPORTS_SCORE) {
        return res.status(400).json({
          success: false,
          error: `Weekly reports override must be between 0 and ${MAX_WEEKLY_REPORTS_SCORE}`,
        });
      }
      finalWeeklyReportsScore = weeklyReportsOverride;
    }

    // Recalculate total with any override
    const finalTotalScore = Math.min(
      MAX_TOTAL_SCORE,
      gradeBreakdown.attendanceScore + finalWeeklyReportsScore + gradeBreakdown.supervisorApprovalScore
    );
    const finalGrade = scoreToGrade(finalTotalScore);

    // Check if grade already exists
    const { data: existingGrade } = await supabase
      .from('supervisor_grades')
      .select('id')
      .eq('student_id', studentId)
      .eq('supervisor_id', supervisorData.id)
      .single();

    const gradeData = {
      student_id: studentId,
      supervisor_id: supervisorData.id,
      grade: finalGrade,
      score: Math.round(finalTotalScore), // Keep old column for compatibility
      attendance_score: gradeBreakdown.attendanceScore,
      weekly_reports_score: finalWeeklyReportsScore,
      supervisor_approval_score: gradeBreakdown.supervisorApprovalScore,
      total_score: finalTotalScore,
      auto_calculated: weeklyReportsOverride === undefined || weeklyReportsOverride === null,
      remarks: remarks || null,
    };

    let result;
    if (existingGrade) {
      // Update existing grade
      const { data, error } = await supabase
        .from('supervisor_grades')
        .update(gradeData)
        .eq('id', existingGrade.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new grade
      const { data, error } = await supabase
        .from('supervisor_grades')
        .insert(gradeData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Update student record to mark as graded AND locked
    // Once graded, student cannot make further edits
    await supabase
      .from('students')
      .update({
        graded: true,
        graded_at: new Date().toISOString(),
        siwes_locked: true,
        siwes_locked_at: new Date().toISOString(),
      })
      .eq('id', studentId);

    res.json({
      success: true,
      message: 'Grade submitted successfully. Student account is now locked.',
      data: {
        ...result,
        breakdown: {
          attendance: { score: gradeBreakdown.attendanceScore, max: MAX_ATTENDANCE_SCORE },
          weeklyReports: { score: finalWeeklyReportsScore, max: MAX_WEEKLY_REPORTS_SCORE },
          supervisorApproval: { score: gradeBreakdown.supervisorApprovalScore, max: MAX_SUPERVISOR_APPROVAL_SCORE },
          total: { score: finalTotalScore, max: MAX_TOTAL_SCORE },
        },
      },
    });
  } catch (error) {
    console.error('Submit grade error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit grade',
    });
  }
};

/**
 * Get student grade with breakdown
 * GET /api/grading/get-grade/:studentId
 */
export const getGrade = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.id;

    // Verify user is supervisor or student
    const { data: studentData } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .single();

    if (!studentData) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    // Check if user is the student or a supervisor
    const isStudent = studentData.user_id === userId;
    const { data: supervisorData } = await supabase
      .from('supervisors')
      .select('id')
      .eq('user_id', userId)
      .eq('supervisor_type', 'school_supervisor')
      .single();

    if (!isStudent && !supervisorData) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Fetch grade
    const { data: gradeData, error: gradeError } = await supabase
      .from('supervisor_grades')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (gradeError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch grade',
      });
    }

    // If grade exists, include breakdown
    if (gradeData) {
      res.json({
        success: true,
        data: {
          ...gradeData,
          breakdown: {
            attendance: { score: gradeData.attendance_score || 0, max: MAX_ATTENDANCE_SCORE },
            weeklyReports: { score: gradeData.weekly_reports_score || 0, max: MAX_WEEKLY_REPORTS_SCORE },
            supervisorApproval: { score: gradeData.supervisor_approval_score || 0, max: MAX_SUPERVISOR_APPROVAL_SCORE },
            total: { score: gradeData.total_score || gradeData.score, max: MAX_TOTAL_SCORE },
          },
        },
      });
    } else {
      res.json({
        success: true,
        data: null,
      });
    }
  } catch (error) {
    console.error('Get grade error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get grade',
    });
  }
};

/**
 * Preview auto-calculated grade (without saving)
 * GET /api/grading/preview/:studentId
 * Returns what the grade would be if calculated now
 */
export const previewGrade = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.id;

    // Verify user is a supervisor
    const { data: supervisorData } = await supabase
      .from('supervisors')
      .select('id')
      .eq('user_id', userId)
      .eq('supervisor_type', 'school_supervisor')
      .single();

    if (!supervisorData) {
      return res.status(403).json({
        success: false,
        error: 'Only school supervisors can preview grades',
      });
    }

    // Verify student exists
    const { data: studentData } = await supabase
      .from('students')
      .select('id, matric_no, full_name')
      .eq('id', studentId)
      .single();

    if (!studentData) {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    // Get attendance count
    const { count: attendanceCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .not('check_in_time', 'is', null);

    // Get weeks stats
    const { data: weeksData } = await supabase
      .from('weeks')
      .select('status')
      .eq('student_id', studentId);

    const submittedWeeks = weeksData?.filter(w => ['submitted', 'approved'].includes(w.status)).length || 0;
    const approvedWeeks = weeksData?.filter(w => w.status === 'approved').length || 0;

    // Calculate grade breakdown
    const gradeBreakdown = await calculateGradeBreakdown(studentId);

    res.json({
      success: true,
      data: {
        student: {
          id: studentData.id,
          matricNo: studentData.matric_no,
          fullName: studentData.full_name,
        },
        stats: {
          attendanceDays: attendanceCount || 0,
          maxAttendanceDays: MAX_EXPECTED_ATTENDANCE_DAYS,
          submittedWeeks,
          approvedWeeks,
          totalWeeks: MAX_WEEKS,
        },
        breakdown: {
          attendance: { score: gradeBreakdown.attendanceScore, max: MAX_ATTENDANCE_SCORE },
          weeklyReports: { score: gradeBreakdown.weeklyReportsScore, max: MAX_WEEKLY_REPORTS_SCORE },
          supervisorApproval: { score: gradeBreakdown.supervisorApprovalScore, max: MAX_SUPERVISOR_APPROVAL_SCORE },
          total: { score: gradeBreakdown.totalScore, max: MAX_TOTAL_SCORE },
        },
        grade: gradeBreakdown.grade,
      },
    });
  } catch (error) {
    console.error('Preview grade error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to preview grade',
    });
  }
};




