/**
 * Logbook Routes
 * Defines endpoints for student logbook management
 */

import express from 'express';
import {
  submitLogbook,
  getMyLogbook,
  getMyLogbookPDF,
} from '../controllers/logbookController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and 'student' role
router.use(requireAuth);
router.use(requireRole('student'));

/**
 * @route   POST /api/logbook/submit
 * @desc    Submit or update a weekly logbook entry
 * @access  Private (Student)
 */
router.post('/submit', submitLogbook);

/**
 * @route   GET /api/logbook/my
 * @desc    Get all logbook entries for the authenticated student
 * @access  Private (Student)
 */
router.get('/my', getMyLogbook);

/**
 * @route   GET /api/logbook/my/pdf
 * @desc    Download logbook as PDF
 * @access  Private (Student)
 */
router.get('/my/pdf', getMyLogbookPDF);

export default router;
