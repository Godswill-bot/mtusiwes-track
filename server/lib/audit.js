/**
 * Audit Logging Service
 * Logs all user activities and changes to the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Create audit log entry
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - User ID who made the change
 * @param {string} params.userType - Type of user (student, school_supervisor, industry_supervisor, admin)
 * @param {string} params.userEmail - User's email
 * @param {string} params.actionType - Type of action (CREATE, UPDATE, DELETE, PASSWORD_RESET, etc.)
 * @param {string} params.tableName - Name of the table affected
 * @param {string} params.recordId - ID of the record affected
 * @param {Object} params.oldValue - Old value (before change)
 * @param {Object} params.newValue - New value (after change)
 * @param {string} params.description - Human-readable description
 * @returns {Promise<Object>} - Result
 */
export const createAuditLog = async ({
  userId,
  userType,
  userEmail,
  actionType,
  tableName,
  recordId,
  oldValue,
  newValue,
  description,
}) => {
  try {
    // Use the database function to create audit log
    const { data, error } = await supabase.rpc('create_audit_log', {
      p_user_id: userId || null,
      p_user_type: userType || null,
      p_user_email: userEmail || null,
      p_action_type: actionType,
      p_table_name: tableName,
      p_record_id: recordId || null,
      p_old_value: oldValue || null,
      p_new_value: newValue || null,
      p_description: description || null,
    });

    if (error) {
      console.error('Error creating audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true, logId: data };
  } catch (error) {
    console.error('Error creating audit log:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create admin notification
 * @param {Object} params - Notification parameters
 * @param {string} params.notificationType - Type of notification
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.userId - User ID related to notification
 * @param {string} params.userType - Type of user
 * @param {string} params.userEmail - User's email
 * @param {string} params.relatedTable - Related table name
 * @param {string} params.relatedRecordId - Related record ID
 * @returns {Promise<Object>} - Result
 */
export const createAdminNotification = async ({
  notificationType,
  title,
  message,
  userId = null,
  userType = null,
  userEmail = null,
  relatedTable = null,
  relatedRecordId = null,
}) => {
  try {
    // Use the database function to create notification for all admins
    const { data, error } = await supabase.rpc('create_admin_notification', {
      p_notification_type: notificationType,
      p_title: title,
      p_message: message,
      p_user_id: userId,
      p_user_type: userType,
      p_user_email: userEmail,
      p_related_table: relatedTable,
      p_related_record_id: relatedRecordId,
    });

    if (error) {
      console.error('Error creating admin notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, notificationId: data };
  } catch (error) {
    console.error('Error creating admin notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Log password change
 */
export const logPasswordChange = async (userId, userType, userEmail) => {
  const auditResult = await createAuditLog({
    userId,
    userType,
    userEmail,
    actionType: 'PASSWORD_RESET',
    tableName: 'auth.users',
    recordId: userId,
    oldValue: null, // Don't store old password
    newValue: { changed: true }, // Just indicate password was changed
    description: `${userType} changed their password`,
  });

  // Create admin notification
  await createAdminNotification({
    notificationType: 'password_reset',
    title: 'Password Reset',
    message: `${userType} (${userEmail}) reset their password`,
    userId,
    userType,
    userEmail,
    relatedTable: 'auth.users',
    relatedRecordId: userId,
  });

  return auditResult;
};

/**
 * Log profile update
 */
export const logProfileUpdate = async (userId, userType, userEmail, tableName, recordId, oldValue, newValue, changes) => {
  const auditResult = await createAuditLog({
    userId,
    userType,
    userEmail,
    actionType: 'UPDATE',
    tableName,
    recordId,
    oldValue,
    newValue,
    description: `${userType} updated their profile: ${changes.join(', ')}`,
  });

  // Create admin notification
  await createAdminNotification({
    notificationType: 'profile_update',
    title: 'Profile Updated',
    message: `${userType} (${userEmail}) updated their profile: ${changes.join(', ')}`,
    userId,
    userType,
    userEmail,
    relatedTable: tableName,
    relatedRecordId: recordId,
  });

  return auditResult;
};

/**
 * Log account creation
 */
export const logAccountCreation = async (userId, userType, userEmail) => {
  const auditResult = await createAuditLog({
    userId,
    userType,
    userEmail,
    actionType: 'CREATE',
    tableName: 'profiles',
    recordId: userId,
    oldValue: null,
    newValue: { user_type: userType, email: userEmail },
    description: `New ${userType} account created: ${userEmail}`,
  });

  // Create admin notification
  await createAdminNotification({
    notificationType: 'account_created',
    title: 'New Account Created',
    message: `New ${userType} account created: ${userEmail}`,
    userId,
    userType,
    userEmail,
    relatedTable: 'profiles',
    relatedRecordId: userId,
  });

  return auditResult;
};

/**
 * Log email verification
 */
export const logEmailVerification = async (userId, userType, userEmail) => {
  const auditResult = await createAuditLog({
    userId,
    userType,
    userEmail,
    actionType: 'EMAIL_VERIFIED',
    tableName: 'profiles',
    recordId: userId,
    oldValue: { email_verified: false },
    newValue: { email_verified: true },
    description: `${userType} verified their email: ${userEmail}`,
  });

  // Create admin notification
  await createAdminNotification({
    notificationType: 'account_verified',
    title: 'Account Verified',
    message: `${userType} (${userEmail}) verified their email address`,
    userId,
    userType,
    userEmail,
    relatedTable: 'profiles',
    relatedRecordId: userId,
  });

  return auditResult;
};

export default {
  createAuditLog,
  createAdminNotification,
  logPasswordChange,
  logProfileUpdate,
  logAccountCreation,
  logEmailVerification,
};

