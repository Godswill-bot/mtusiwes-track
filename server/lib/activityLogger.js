/**
 * Activity Logger Module
 * Logs all user activities to the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - IP address
 */
export const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
};

/**
 * Get user agent from request
 * @param {Object} req - Express request object
 * @returns {string} - User agent
 */
export const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Log user activity to database
 * @param {Object} params - Activity parameters
 * @param {string} params.userId - User ID (optional)
 * @param {string} params.userType - User type (student, school_supervisor, industry_supervisor, admin)
 * @param {string} params.userEmail - User email
 * @param {string} params.activityType - Activity type
 * @param {Object} params.activityDetails - Additional activity details (optional)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 * @param {boolean} params.success - Whether activity was successful (default: true)
 * @param {string} params.errorMessage - Error message if activity failed (optional)
 * @returns {Promise<Object>} - Logging result
 */
export const logUserActivity = async ({
  userId = null,
  userType = null,
  userEmail,
  activityType,
  activityDetails = null,
  ipAddress = null,
  userAgent = null,
  success = true,
  errorMessage = null,
}) => {
  try {
    // Call the database function to log activity
    const { data, error } = await supabase.rpc('log_user_activity', {
      p_user_id: userId,
      p_user_type: userType,
      p_user_email: userEmail,
      p_activity_type: activityType,
      p_activity_details: activityDetails,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_success: success,
      p_error_message: errorMessage,
    });

    if (error) {
      console.error('Error logging user activity:', error);
      // Don't throw - logging failures shouldn't break the app
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      activityId: data,
    };
  } catch (error) {
    console.error('Error in logUserActivity:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Log registration activity
 */
export const logRegistration = async (req, userId, userType, userEmail, success = true, errorMessage = null) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: 'registration',
    activityDetails: {
      role: userType,
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success,
    errorMessage,
  });
};

/**
 * Log signup activity
 */
export const logSignup = async (req, userId, userType, userEmail, success = true, errorMessage = null) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: 'signup',
    activityDetails: {
      role: userType,
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success,
    errorMessage,
  });
};

/**
 * Log login activity
 */
export const logLogin = async (req, userId, userType, userEmail, success = true, errorMessage = null) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: success ? 'login_success' : 'login_failed',
    activityDetails: {
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success,
    errorMessage,
  });
};

/**
 * Log email verification activity
 */
export const logEmailVerification = async (req, userId, userType, userEmail, success = true, errorMessage = null) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: 'email_verification',
    activityDetails: {
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success,
    errorMessage,
  });
};

/**
 * Log password reset request
 */
export const logPasswordResetRequest = async (req, userEmail, success = true, errorMessage = null) => {
  return await logUserActivity({
    userEmail,
    activityType: 'password_reset_request',
    activityDetails: {
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success,
    errorMessage,
  });
};

/**
 * Log password reset success
 */
export const logPasswordResetSuccess = async (req, userId, userType, userEmail, success = true, errorMessage = null) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: 'password_reset_success',
    activityDetails: {
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success,
    errorMessage,
  });
};

/**
 * Log password change
 */
export const logPasswordChange = async (req, userId, userType, userEmail) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: 'password_change',
    activityDetails: {
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });
};

/**
 * Log profile update
 */
export const logProfileUpdate = async (req, userId, userType, userEmail, changes = {}) => {
  return await logUserActivity({
    userId,
    userType,
    userEmail,
    activityType: 'profile_update',
    activityDetails: {
      changes,
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });
};

/**
 * Log pre-registration submission
 */
export const logPreRegistrationSubmit = async (req, userId, userEmail) => {
  return await logUserActivity({
    userId,
    userType: 'student',
    userEmail,
    activityType: 'pre_registration_submit',
    activityDetails: {
      timestamp: new Date().toISOString(),
    },
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req),
    success: true,
  });
};

export default {
  logUserActivity,
  logRegistration,
  logSignup,
  logLogin,
  logEmailVerification,
  logPasswordResetRequest,
  logPasswordResetSuccess,
  logPasswordChange,
  logProfileUpdate,
  logPreRegistrationSubmit,
  getClientIP,
  getUserAgent,
};

