/**
 * Attendance Controller
 * Handles student daily check-ins with server-side timestamp validation.
 * 
 * Rules:
 * - One check-in per day per student
 * - Server-side timestamp validation (prevents manipulation)
 * - Check-in marks student as "present" for that day
 * - Locked students cannot check-in
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Student check-in for today
 * POST /api/attendance/check-in
 */
export const checkIn = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, siwes_locked, full_name, matric_no")
      .eq("user_id", userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // Check if student is locked
    if (student.siwes_locked) {
      return res.status(403).json({ 
        error: "Your SIWES has been completed and graded. No more check-ins allowed." 
      });
    }

    // Get current date (server-side - prevents manipulation)
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });

    // Check if already checked in today
    const { data: existingAttendance, error: checkError } = await supabase
      .from("attendance")
      .select("id, check_in_time, check_out_time")
      .eq("student_id", student.id)
      .eq("date", today)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingAttendance) {
      // Already checked in today
      return res.status(400).json({ 
        error: "You have already checked in today",
        attendance: existingAttendance
      });
    }

    // Create new attendance record with check-in time
    const { data: newAttendance, error: insertError } = await supabase
      .from("attendance")
      .insert({
        student_id: student.id,
        date: today,
        check_in_time: currentTime,
        verified: true, // Auto-verified since it's server-validated
      })
      .select()
      .single();

    if (insertError) {
      // Check for unique constraint violation (duplicate check-in)
      if (insertError.code === '23505') {
        return res.status(400).json({ error: "You have already checked in today" });
      }
      throw insertError;
    }

    return res.status(201).json({
      message: "Check-in successful!",
      attendance: newAttendance,
      time: currentTime
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return res.status(500).json({ error: "Failed to record check-in" });
  }
};

/**
 * Student check-out for today
 * POST /api/attendance/check-out
 */
export const checkOut = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, siwes_locked")
      .eq("user_id", userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // Check if student is locked
    if (student.siwes_locked) {
      return res.status(403).json({ 
        error: "Your SIWES has been completed and graded. No more check-outs allowed." 
      });
    }

    // Get current date (server-side)
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });

    // Get today's attendance record
    const { data: existingAttendance, error: checkError } = await supabase
      .from("attendance")
      .select("id, check_in_time, check_out_time")
      .eq("student_id", student.id)
      .eq("date", today)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!existingAttendance) {
      return res.status(400).json({ 
        error: "You must check in first before checking out" 
      });
    }

    if (existingAttendance.check_out_time) {
      return res.status(400).json({ 
        error: "You have already checked out today",
        attendance: existingAttendance
      });
    }

    // Update with check-out time
    const { data: updatedAttendance, error: updateError } = await supabase
      .from("attendance")
      .update({
        check_out_time: currentTime
      })
      .eq("id", existingAttendance.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      message: "Check-out successful!",
      attendance: updatedAttendance,
      time: currentTime
    });
  } catch (error) {
    console.error("Check-out error:", error);
    return res.status(500).json({ error: "Failed to record check-out" });
  }
};

/**
 * Get today's attendance status for student
 * GET /api/attendance/today
 */
export const getTodayStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, siwes_locked")
      .eq("user_id", userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // Get current date
    const today = new Date().toISOString().split('T')[0];

    // Get today's attendance
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", student.id)
      .eq("date", today)
      .maybeSingle();

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      throw attendanceError;
    }

    return res.json({
      date: today,
      hasCheckedIn: !!attendance?.check_in_time,
      hasCheckedOut: !!attendance?.check_out_time,
      attendance: attendance || null,
      siwesLocked: student.siwes_locked
    });
  } catch (error) {
    console.error("Get today status error:", error);
    return res.status(500).json({ error: "Failed to get attendance status" });
  }
};

/**
 * Get student's full attendance history
 * GET /api/attendance/history
 */
export const getAttendanceHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student record not found" });
    }

    // Get all attendance records
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", student.id)
      .order("date", { ascending: false });

    if (attendanceError) {
      throw attendanceError;
    }

    // Calculate statistics
    const totalDays = attendance.length;
    const daysWithCheckOut = attendance.filter(a => a.check_in_time && a.check_out_time).length;
    const verifiedDays = attendance.filter(a => a.verified).length;

    return res.json({
      attendance: attendance || [],
      stats: {
        totalDays,
        daysWithCheckOut,
        verifiedDays
      }
    });
  } catch (error) {
    console.error("Get attendance history error:", error);
    return res.status(500).json({ error: "Failed to get attendance history" });
  }
};

/**
 * Supervisor: Get attendance for a specific student
 * GET /api/attendance/student/:studentId
 */
export const getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student info with attendance
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select(`
        id, full_name, matric_no, department, level, organisation_name,
        user_id
      `)
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get profile for additional info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", student.user_id)
      .single();

    // Get all attendance records
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: true });

    if (attendanceError) {
      throw attendanceError;
    }

    // Calculate statistics
    const totalDays = attendance.length;
    const daysWithCheckOut = attendance.filter(a => a.check_in_time && a.check_out_time).length;
    const verifiedDays = attendance.filter(a => a.verified).length;

    // Calculate total hours worked
    let totalHours = 0;
    attendance.forEach(record => {
      if (record.check_in_time && record.check_out_time) {
        const checkIn = new Date(`1970-01-01T${record.check_in_time}`);
        const checkOut = new Date(`1970-01-01T${record.check_out_time}`);
        const hours = (checkOut - checkIn) / (1000 * 60 * 60);
        if (hours > 0) totalHours += hours;
      }
    });

    return res.json({
      student: {
        id: student.id,
        fullName: profile?.full_name || student.full_name,
        matricNo: student.matric_no,
        department: student.department,
        level: student.level,
        organisation: student.organisation_name
      },
      attendance: attendance || [],
      stats: {
        totalDays,
        daysWithCheckOut,
        verifiedDays,
        totalHours: Math.round(totalHours * 10) / 10
      }
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    return res.status(500).json({ error: "Failed to get student attendance" });
  }
};

/**
 * Supervisor: Get attendance summary for all assigned students
 * GET /api/attendance/supervisor/summary
 */
export const getSupervisorAttendanceSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[Supervisor Attendance] Fetching summary for user: ${userId}`);

    // Get supervisor record
    const { data: supervisor, error: supervisorError } = await supabase
      .from("supervisors")
      .select("id, user_id")
      .eq("user_id", userId)
      .single();

    if (supervisorError) {
      console.error("[Supervisor Attendance] Supervisor lookup error:", supervisorError);
      return res.status(404).json({ error: "Supervisor record not found. Please contact admin." });
    }

    if (!supervisor) {
      console.error("[Supervisor Attendance] No supervisor found for user:", userId);
      return res.status(404).json({ error: "Supervisor record not found" });
    }

    console.log(`[Supervisor Attendance] Found supervisor: ${supervisor.id}`);

    // Get assigned students
    const { data: assignments, error: assignmentsError } = await supabase
      .from("supervisor_assignments")
      .select(`
        student_id,
        students (
          id, full_name, matric_no, department, user_id
        )
      `)
      .eq("supervisor_id", supervisor.id);

    if (assignmentsError) {
      console.error("[Supervisor Attendance] Assignments error:", assignmentsError);
      throw assignmentsError;
    }

    // Handle no assignments case gracefully
    if (!assignments || assignments.length === 0) {
      console.log("[Supervisor Attendance] No students assigned to supervisor");
      return res.json({
        students: [],
        date: new Date().toISOString().split('T')[0]
      });
    }

    console.log(`[Supervisor Attendance] Found ${assignments.length} student assignments`);

    // Filter out any invalid assignments (where student doesn't exist)
    const validAssignments = assignments.filter(a => a.students && a.student_id);
    
    // Get attendance for each student
    const studentIds = validAssignments.map(a => a.student_id);

    let attendance = [];
    if (studentIds.length > 0) {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds);

      if (attendanceError) {
        console.error("[Supervisor Attendance] Attendance fetch error:", attendanceError);
        throw attendanceError;
      }
      attendance = attendanceData || [];
    }

    // Get profiles for user names
    const userIds = validAssignments
      .filter(a => a.students?.user_id)
      .map(a => a.students.user_id);

    let profiles = [];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profiles = profilesData || [];
    }

    // Build summary per student
    const studentSummaries = validAssignments.map(assignment => {
      const student = assignment.students;
      const profile = profiles.find(p => p.id === student.user_id);
      const studentAttendance = attendance.filter(a => a.student_id === student.id);
      
      // Calculate stats
      const totalDays = studentAttendance.length;
      const daysWithCheckOut = studentAttendance.filter(a => a.check_in_time && a.check_out_time).length;

      // Today's status
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = studentAttendance.find(a => a.date === today);

      return {
        studentId: student.id,
        fullName: profile?.full_name || student.full_name || "Unknown",
        matricNo: student.matric_no || "N/A",
        department: student.department || "N/A",
        totalDays,
        daysWithCheckOut,
        todayStatus: todayAttendance ? {
          checkedIn: !!todayAttendance.check_in_time,
          checkedOut: !!todayAttendance.check_out_time,
          checkInTime: todayAttendance.check_in_time,
          checkOutTime: todayAttendance.check_out_time
        } : null
      };
    });

    console.log(`[Supervisor Attendance] Returning ${studentSummaries.length} student summaries`);

    return res.json({
      students: studentSummaries,
      date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error("[Supervisor Attendance] Error:", error);
    return res.status(500).json({ error: "Failed to get attendance summary. Please try again." });
  }
};

export default {
  checkIn,
  checkOut,
  getTodayStatus,
  getAttendanceHistory,
  getStudentAttendance,
  getSupervisorAttendanceSummary
};
