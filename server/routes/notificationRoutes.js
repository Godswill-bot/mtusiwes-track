/**
 * Notification Routes
 * Defines endpoints for user notifications
 */

import express from 'express';
import {
  getNotifications,
  markAsRead,
} from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', getNotifications);

/**
 * @route   POST /api/notifications/mark-read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.post('/mark-read', markAsRead);

export default router;
