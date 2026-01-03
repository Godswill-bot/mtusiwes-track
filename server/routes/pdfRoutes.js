/**
 * PDF Generation Routes
 */

import express from 'express';
import {
  generateStudentSummaryPDF,
  generateSupervisorGradingPDF,
  generateWeekPDF,
  compileLogbook,
  generateAttendancePDF,
} from '../controllers/pdfController.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /generate-student-pdf
 * @desc    Generate student 24-week summary PDF
 * @access  Private (Student or Supervisor)
 */
router.post('/generate-student-pdf', verifyAuth, generateStudentSummaryPDF);

/**
 * @route   POST /generate-supervisor-pdf
 * @desc    Generate supervisor grading PDF
 * @access  Private (Supervisor)
 */
router.post('/generate-supervisor-pdf', verifyAuth, generateSupervisorGradingPDF);

/**
 * @route   POST /generate-week-pdf
 * @desc    Generate individual weekly report PDF with images and stamps
 * @access  Private (Student or Supervisor)
 */
router.post('/generate-week-pdf', verifyAuth, generateWeekPDF);

/**
 * @route   POST /compile-logbook
 * @desc    Compile complete 24-week logbook into single PDF
 * @access  Private (Supervisor)
 */
router.post('/compile-logbook', verifyAuth, compileLogbook);

/**
 * @route   GET /attendance/:studentId
 * @desc    Generate attendance PDF for a student
 * @access  Private (Supervisor)
 */
router.get('/attendance/:studentId', verifyAuth, generateAttendancePDF);

export default router;

