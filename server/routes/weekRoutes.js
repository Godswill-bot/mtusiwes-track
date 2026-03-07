
import express from 'express';
import { submitWeek, reviewWeek, getWeekWithImages } from '../controllers/weekController.js';
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /:weekId
 * @desc    Get a week by ID with all image URLs
 * @access  Private (Supervisor/Student)
 */
router.get('/:weekId', getWeekWithImages);

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

