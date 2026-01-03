/**
 * Weekly Report Routes
 */

import express from 'express';
import { submitWeek, reviewWeek } from '../controllers/weekController.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /submit-week
 * @desc    Submit weekly logbook entry
 * @access  Private (Student)
 */
router.post('/submit-week', submitWeek);

/**
 * @route   POST /supervisor/review-week
 * @desc    Supervisor approve/reject weekly report
 * @access  Private (Supervisor)
 */
router.post('/supervisor/review-week', verifyAuth, reviewWeek);

export default router;

