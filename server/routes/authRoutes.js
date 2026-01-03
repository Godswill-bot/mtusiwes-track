/**
 * Authentication Routes
 * Defines all authentication-related API endpoints
 */

import express from 'express';
import {
  register,
  verifyEmail,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @route   POST /register
 * @desc    Register new user with email verification
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /verify-email
 * @desc    Verify email with OTP
 * @access  Public
 */
router.post('/verify-email', verifyEmail);

/**
 * @route   POST /login
 * @desc    Login user (checks verification status)
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /forgot-password
 * @desc    Request password reset OTP
 * @access  Public
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /verify-reset-otp
 * @desc    Verify password reset OTP
 * @access  Public
 */
router.post('/verify-reset-otp', verifyResetOTP);

/**
 * @route   POST /reset-password
 * @desc    Reset password with verified OTP
 * @access  Public
 */
router.post('/reset-password', resetPassword);

/**
 * @route   POST /log-activity
 * @desc    Log user activity from frontend
 * @access  Public
 */
router.post('/log-activity', async (req, res) => {
  try {
    const { logUserActivity } = await import('../lib/activityLogger.js');
    const { createAuditLog } = await import('../lib/audit.js');
    
    // Log to user_activities table
    const result = await logUserActivity({
      userId: req.body.userId || null,
      userType: req.body.userType || null,
      userEmail: req.body.userEmail,
      activityType: req.body.activityType,
      activityDetails: req.body.activityDetails || null,
      ipAddress: req.body.ipAddress || null,
      userAgent: req.body.userAgent || null,
      success: req.body.success !== undefined ? req.body.success : true,
      errorMessage: req.body.errorMessage || null,
    });

    // Also create audit log entry for admin visibility (for supervisor and student actions)
    if (req.body.userType && (req.body.userType === 'school_supervisor' || req.body.userType === 'industry_supervisor' || req.body.userType === 'student')) {
      // Map activity types to audit log action types
      const actionTypeMap = {
        'pre_registration_approve': 'UPDATE',
        'pre_registration_reject': 'UPDATE',
        'pre_registration_submit': 'UPDATE',
        'week_submit': 'CREATE',
        'week_approve': 'UPDATE',
        'week_reject': 'UPDATE',
        'supervisor_assignment': 'CREATE',
      };

      const actionType = actionTypeMap[req.body.activityType] || 'UPDATE';
      const tableName = req.body.activityDetails?.studentId ? 'students' : 
                       req.body.activityType?.includes('week') ? 'weeks' :
                       req.body.activityType === 'supervisor_assignment' ? 'supervisor_assignments' :
                       'students';

      const recordId = req.body.activityDetails?.studentId || 
                      req.body.activityDetails?.weekId || 
                      req.body.activityDetails?.assignmentId || 
                      null;

      // Create audit log entry
      await createAuditLog({
        userId: req.body.userId || null,
        userType: req.body.userType,
        userEmail: req.body.userEmail,
        actionType: actionType,
        tableName: tableName,
        recordId: recordId,
        oldValue: null,
        newValue: req.body.activityDetails || null,
        description: `${req.body.userType} ${req.body.activityType}: ${req.body.userEmail}`,
      }).catch(err => {
        // Don't fail the request if audit log creation fails
        console.error('Failed to create audit log:', err);
      });
    }

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ success: false, error: 'Failed to log activity' });
  }
});

export default router;




