/**
 * Grading Routes
 * Rule-Based 30-Point Grading System
 */

import express from 'express';
import { submitGrade, getGrade, previewGrade } from '../controllers/gradingController.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /submit-grade
 * @desc    Submit supervisor grade for student (auto-calculates based on rules)
 * @access  Private (Supervisor)
 */
router.post('/submit-grade', verifyAuth, submitGrade);

/**
 * @route   GET /get-grade/:studentId
 * @desc    Get student grade with breakdown
 * @access  Private (Student or Supervisor)
 */
router.get('/get-grade/:studentId', verifyAuth, getGrade);

/**
 * @route   GET /preview/:studentId
 * @desc    Preview auto-calculated grade without saving
 * @access  Private (Supervisor)
 */
router.get('/preview/:studentId', verifyAuth, previewGrade);

export default router;

