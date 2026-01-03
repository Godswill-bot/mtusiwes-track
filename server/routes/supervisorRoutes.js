/**
 * Supervisor Routes
 * Defines endpoints for supervisor operations
 */

import express from 'express';
import {
  getAssignedStudents,
  getStudentLogbook,
  gradeLogbook,
} from '../controllers/supervisorController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and 'school_supervisor' role
// Note: 'industry_supervisor' might also need access, but 'grade' usually implies school.
// If industry supervisors also use this, we can adjust the role check.
// For now, we'll allow 'school_supervisor' as per standard SIWES flow where school grades.
router.use(requireAuth);
router.use(requireRole('school_supervisor'));

/**
 * @route   GET /api/supervisor/students
 * @desc    Get all students assigned to the supervisor
 * @access  Private (School Supervisor)
 */
router.get('/students', getAssignedStudents);

/**
 * @route   GET /api/supervisor/logbook/:studentId
 * @desc    Get logbook entries for a specific student
 * @access  Private (School Supervisor)
 */
router.get('/logbook/:studentId', getStudentLogbook);

/**
 * @route   POST /api/supervisor/grade
 * @desc    Grade a weekly logbook entry
 * @access  Private (School Supervisor)
 */
router.post('/grade', gradeLogbook);

export default router;
