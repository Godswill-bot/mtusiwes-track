/**
 * Attendance Routes
 * Handles student daily check-in/check-out functionality
 */

import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import attendanceController from "../controllers/attendanceController.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Student routes
router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", attendanceController.checkOut);
router.get("/today", attendanceController.getTodayStatus);
router.get("/history", attendanceController.getAttendanceHistory);

// Supervisor routes
router.get("/student/:studentId", attendanceController.getStudentAttendance);
router.get("/supervisor/summary", attendanceController.getSupervisorAttendanceSummary);

export default router;
