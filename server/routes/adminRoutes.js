import express from 'express';
import {
  downloadMasterListPDF,
  downloadMasterListCSV,
  downloadPlacementListPDF,
  downloadPlacementListCSV,
  downloadSupervisorAssignmentsPDF,
  downloadSupervisorAssignmentsCSV,
  downloadWeeklyReportsPDF,
  downloadWeeklyReportsCSV,
  downloadStudentLogbookPDF,
  getUsers,
  getLogbooks,
  getReports,
  getStudents,
  getSupervisors,
} from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Admin download routes (Existing - keeping as is, but ideally should be protected)
// If I protect them now, I might break existing clients if they don't send token.
// But for new routes, I MUST protect them.

router.post('/download-master-list-pdf', downloadMasterListPDF);
router.post('/download-master-list-csv', downloadMasterListCSV);
router.post('/download-placement-list-pdf', downloadPlacementListPDF);
router.post('/download-placement-list-csv', downloadPlacementListCSV);
router.post('/download-supervisor-assignments-pdf', downloadSupervisorAssignmentsPDF);
router.post('/download-supervisor-assignments-csv', downloadSupervisorAssignmentsCSV);
router.post('/download-weekly-reports-pdf', downloadWeeklyReportsPDF);
router.post('/download-weekly-reports-csv', downloadWeeklyReportsCSV);
router.post('/download-student-logbook-pdf', downloadStudentLogbookPDF);

// New Admin API Routes (Protected)
router.use(requireAuth);
router.use(requireRole('admin'));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Private (Admin)
 */
router.get('/users', getUsers);

/**
 * @route   GET /api/admin/logbooks
 * @desc    Get all logbooks
 * @access  Private (Admin)
 */
router.get('/logbooks', getLogbooks);

/**
 * @route   GET /api/admin/reports
 * @desc    Get system reports
 * @access  Private (Admin)
 */
router.get('/reports', getReports);

/**
 * @route   GET /api/admin/students
 * @desc    Get all students
 * @access  Private (Admin)
 */
router.get('/students', getStudents);

/**
 * @route   GET /api/admin/supervisors
 * @desc    Get all supervisors
 * @access  Private (Admin)
 */
router.get('/supervisors', getSupervisors);

export default router;
















