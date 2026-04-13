/**
 * Authentication Controller
 * Handles all authentication-related operations
 */

import {
  generateOTP,
  saveOTP,
  verifyOTP,
  checkEmailExists,
  markUserAsVerified,
  updateUserPassword,
} from '../lib/database.js';
import { sendOTPEmail, sendPasswordResetEmail, sendAdminProfileChangeEmail } from '../lib/email.js';
import {
  logAccountCreation,
  logEmailVerification,
  logPasswordChange,
  logProfileUpdate,
} from '../lib/audit.js';
import {
  logRegistration,
  logSignup,
  logLogin,
  logEmailVerification as logEmailVerificationActivity,
  logPasswordResetRequest,
  logPasswordResetSuccess,
  logPasswordChange as logPasswordChangeActivity,
} from '../lib/activityLogger.js';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  encryptProfileChangeSecret,
  decryptProfileChangeSecret,
  replacePendingAdminProfileChange,
  getPendingAdminProfileChange,
  completePendingAdminProfileChange,
} from '../lib/adminProfile.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

/**
 * Validate MTU email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Validation result
 */
const validateMTUEmail = (email) => {
  const mtuEmailRegex = /^[a-zA-Z0-9]+@mtu\.edu\.ng$/;
  return mtuEmailRegex.test(email);
};

const validateAnyEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || '').trim());
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getAuthUserById = async (userId) => {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const users = data?.users || [];
  return users.find((user) => user.id === userId) || null;
};

/**
 * Register new user
 * POST /register
 */
export const register = async (req, res) => {
  try {
    const { firstname, lastname, matricNumber, email, password, role } = req.body;

    // Determine role - default to 'student' if not provided
    const userRole = role || 'student';

    // Validate required fields based on role
    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All required fields are missing',
      });
    }

    // Matric number is required only for students
    if (userRole === 'student' && !matricNumber) {
      return res.status(400).json({
        success: false,
        error: 'Matric number is required for students',
      });
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Only MTU email addresses (@mtu.edu.ng) are allowed',
      });
    }

    if (userRole === 'student') {
      const normalizedEmail = String(email).toLowerCase().trim();
      const { data: blockedEmail } = await supabase
        .from('blocked_student_emails')
        .select('email, blocked_reason')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (blockedEmail) {
        return res.status(403).json({
          success: false,
          error: blockedEmail.blocked_reason || 'This email is no longer eligible for student self-service signup.',
        });
      }
    }

    // Check if email already exists
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
      });
    }

    // Check if matric number already exists (for students only)
    if (userRole === 'student' && matricNumber) {
      const { data: existingMatric } = await supabase
        .from('students')
        .select('user_id, matric_no')
        .eq('matric_no', matricNumber.trim())
        .maybeSingle();

      if (existingMatric) {
        return res.status(400).json({
          success: false,
          error: 'This matriculation number is already registered. Please check your matric number and try again.',
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP to database
    const otpResult = await saveOTP(email, otp, 'verification');
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate verification code',
      });
    }

    // Prepare user metadata
    const userMetadata = {
      firstname,
      lastname,
      full_name: `${firstname} ${lastname}`,
      email_verified: false,
      role: userRole,
    };

    // Add matric number for students
    if (userRole === 'student' && matricNumber) {
      userMetadata.matric_number = matricNumber;
    }

    // Determine email confirmation status
    // TEMPORARY: Supervisors (admin-created and trusted) are auto-confirmed
    // Students must verify their email
    const isSupervisor = userRole === 'school_supervisor' || userRole === 'industry_supervisor';
    const emailConfirm = isSupervisor ? true : false;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: emailConfirm, // Supervisors: true (auto-confirmed), Students: false (must verify)
      user_metadata: userMetadata,
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        error: authError.message || 'Failed to create account',
      });
    }

    // Create profile
    // TEMPORARY: Supervisors are auto-confirmed, so set email_verified to match
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: `${firstname} ${lastname}`,
        role: userRole,
        email_verified: emailConfirm, // Match email_confirmed_at status
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Continue even if profile creation fails
    }

    // Create student or supervisor record based on role
    if (userRole === 'student') {
      // Get additional student data from request body
      const { phone, faculty, department } = req.body;
      
      // Create minimal student record (other fields will be filled in Pre-SIWES form)
      // Note: Matric number is required, so we use the one from request
      const { error: studentError, data: insertedStudent } = await supabase
        .from('students')
        .insert({
          user_id: authData.user.id,
          full_name: `${firstname} ${lastname}`,
          email: email,
          matric_no: matricNumber, // Required field - should be provided
          faculty: faculty || 'TBD',
          department: department || 'TBD',
          phone: phone || '',
          // Required fields with default/placeholder values (will be updated in Pre-SIWES form)
          organisation_name: 'To be updated',
          organisation_address: 'To be updated',
          nature_of_business: 'To be updated',
          location_size: 'medium',
          products_services: 'To be updated',
          industry_supervisor_name: 'To be updated',
          period_of_training: 'To be updated',
        })
        .select('id')
        .single();

      if (studentError) {
        console.error('Student record creation error:', studentError);
        // Log error but don't fail registration - user can complete profile later
        // Return a warning in the response
      } else if (insertedStudent?.id) {
        // Link student to current academic session
        try {
          const { data: currentSession } = await supabase
            .from('academic_sessions')
            .select('id')
            .eq('is_current', true)
            .single();

          if (currentSession) {
             await supabase
               .from('students')
               .update({ placement_session_id: currentSession.id })
               .eq('id', insertedStudent.id);
          }
        } catch (sessionErr) {
          console.error('Error linking student to session:', sessionErr);
        }

        // Automatically assign student to a school supervisor
        try {
          const { data: assignedSupervisorId, error: assignmentError } = await supabase.rpc(
            'assign_student_to_school_supervisor',
            { p_student_id: insertedStudent.id }
          );

          if (assignmentError || !assignedSupervisorId) {
            console.error('RPC assignment failed or returned no supervisor:', assignmentError);

            // Fallback: direct assignment using service-role access
            const { data: currentSession } = await supabase
              .from('academic_sessions')
              .select('id')
              .eq('is_current', true)
              .maybeSingle();

            if (currentSession?.id) {
              const { data: availableSupervisors } = await supabase
                .from('supervisors')
                .select('id, name, email')
                .eq('supervisor_type', 'school_supervisor')
                .eq('is_active', true);

              if (availableSupervisors && availableSupervisors.length > 0) {
                const randSup = availableSupervisors[Math.floor(Math.random() * availableSupervisors.length)];

                const { error: directAssignError } = await supabase
                  .from('supervisor_assignments')
                  .upsert(
                    {
                      student_id: insertedStudent.id,
                      supervisor_id: randSup.id,
                      session_id: currentSession.id,
                      assignment_type: 'school_supervisor',
                      assigned_at: new Date().toISOString(),
                    },
                    { onConflict: 'supervisor_id,student_id,session_id,assignment_type' }
                  );

                if (directAssignError) {
                  console.error('Fallback assignment failed during registration:', directAssignError);
                } else {
                  await supabase
                    .from('students')
                    .update({
                      school_supervisor_name: randSup.name,
                      school_supervisor_email: randSup.email,
                    })
                    .eq('id', insertedStudent.id);
                }
              }
            }
          }
        } catch (assignmentErr) {
          console.error('Unexpected error during supervisor assignment:', assignmentErr);
          // Don't block registration
        }
      }
    } else if (userRole === 'school_supervisor' || userRole === 'industry_supervisor') {
      // Get additional supervisor data from request body
      const { phone } = req.body;
      
      // Create supervisor record
      const { error: supervisorError } = await supabase
        .from('supervisors')
        .insert({
          user_id: authData.user.id,
          name: `${firstname} ${lastname}`,
          email: email,
          phone: phone || '',
          supervisor_type: userRole === 'school_supervisor' ? 'school_supervisor' : 'industry_supervisor',
        });

      if (supervisorError) {
        console.error('Supervisor record creation error:', supervisorError);
        // Don't fail registration, but log the error
      }
    }

    // Send verification email only if email is not auto-confirmed
    // TEMPORARY: Supervisors are auto-confirmed, so skip verification email
    if (!emailConfirm) {
      const emailResult = await sendOTPEmail(email, otp, 'verification');
      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Account created but failed to send verification email. Please contact support.',
        });
      }
    }

    // Log account creation
    await logAccountCreation(authData.user.id, userRole, email);
    
    // Log registration activity
    await logRegistration(req, authData.user.id, userRole, email, true);

    // Return appropriate message based on email confirmation status
    // TEMPORARY: Supervisors are auto-confirmed and can login immediately
    const successMessage = emailConfirm
      ? 'Supervisor account created successfully. You can now log in.'
      : 'Registration successful. Please check your email for verification code.';

    res.status(201).json({
      success: true,
      message: successMessage,
      userId: authData.user.id,
      role: userRole,
      emailConfirmed: emailConfirm,
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code) {
      errorMessage = `Database error: ${error.code}`;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * Verify email with OTP
 * POST /verify-email
 */
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required',
      });
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Verify OTP
    const verificationResult = await verifyOTP(email, otp, 'verification');
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
      });
    }

    // Mark user as verified
    const verifyResult = await markUserAsVerified(email);
    if (!verifyResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to verify email',
      });
    }

    // Get user info for audit logging
    try {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const users = listData?.users || [];
      const user = users.find(u => u.email === email);
      if (user) {
        const userRole = user.user_metadata?.role || 'student';
        await logEmailVerification(user.id, userRole, email);
        // Also log to user_activities
        await logEmailVerificationActivity(req, user.id, userRole, email, true);
      }
    } catch (auditError) {
      console.error('Error logging email verification:', auditError);
      // Don't fail the request if audit logging fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Login user
 * POST /login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Only MTU email addresses are allowed',
      });
    }

    // Check if user exists and is verified
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    const users = listData?.users || [];

    const user = users.find(u => u.email === email);
    if (!user) {
      // Log failed login attempt
      await logLogin(req, null, null, email, false, 'User not found');
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Get user type
    const userType = user.user_metadata?.role || 'student';

    // TEMPORARY: Allow supervisors to login without email verification
    // Email verification check: Required for students and admins, bypassed for supervisors
    // Supervisors (school_supervisor and industry_supervisor) can login without email verification
    const requiresEmailVerification = userType === 'student' || userType === 'admin';

    if (requiresEmailVerification) {
      // Check if email is verified (check both user_metadata and profiles table)
      const isVerifiedInMetadata = user.user_metadata?.email_verified;
      
      // Also check profiles table as fallback
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('id', user.id)
        .maybeSingle();
      
      const isVerifiedInProfile = profile?.email_verified;
      
      // User is verified if either source says so
      const isEmailVerified = isVerifiedInMetadata || isVerifiedInProfile;
      
      if (!isEmailVerified) {
        // Log failed login attempt (email not verified)
        await logLogin(req, user.id, userType, email, false, 'Email not verified');
        return res.status(403).json({
          success: false,
          error: 'Please verify your email before logging in',
          requiresVerification: true,
        });
      }
    }
    // Supervisors bypass email verification check - they can login without verification

    // Note: Actual password verification should be done via Supabase Auth client-side
    // This endpoint just checks if user exists and is verified
    // The frontend should use Supabase Auth signInWithPassword

    // Log successful login check (actual login will be logged by frontend)
    await logLogin(req, user.id, userType, email, true);

    res.json({
      success: true,
      message: 'User verified. Please use Supabase Auth to complete login.',
      userId: user.id,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Request password reset
 * POST /forgot-password
 * Sends email with current password and reset link
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Only MTU email addresses (@mtu.edu.ng) are allowed',
      });
    }

    // Check if email exists in database
    const emailCheck = await checkEmailExists(email);
    if (!emailCheck.exists) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If the email exists, a password reset email has been sent.',
      });
    }

    // Generate OTP for password reset
    const otp = generateOTP();

    // Save OTP to database
    const otpResult = await saveOTP(email, otp, 'reset');
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate reset code',
      });
    }

    // Get user's current password from profiles or students/supervisors table
    // Note: We can't retrieve the actual password (it's hashed), but we can send reset instructions
    // For security, we'll send a reset link instead of the actual password
    
    // Generate reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?email=${encodeURIComponent(email)}&otp=${otp}`;

    // Send password reset email with reset link
    const emailResult = await sendPasswordResetEmail(email, resetLink, otp);
    
    if (!emailResult.success) {
      // Log failed password reset request
      await logPasswordResetRequest(req, email, false, 'Failed to send reset email');
      return res.status(500).json({
        success: false,
        error: 'Failed to send reset email',
      });
    }

    // Log password reset request
    await logPasswordResetRequest(req, email, true);

    res.json({
      success: true,
      message: 'Check your MTU email. You have been sent an email with your password and reset options.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Verify reset OTP
 * POST /verify-reset-otp
 */
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required',
      });
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Verify OTP
    const verificationResult = await verifyOTP(email, otp, 'reset');
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
      });
    }

    res.json({
      success: true,
      message: 'OTP verified. You can now reset your password.',
    });
  } catch (error) {
    console.error('Reset OTP verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Reset password
 * POST /reset-password
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, OTP, and new password are required',
      });
    }

    // Validate MTU email
    if (!validateMTUEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    // Verify OTP first
    const verificationResult = await verifyOTP(email, otp, 'reset');
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
      });
    }

    // Update password (this preserves email verification status)
    const updateResult = await updateUserPassword(email, newPassword);
    if (!updateResult.success) {
      // Log failed password reset
      await logPasswordResetSuccess(req, null, null, email, false, updateResult.error);
      return res.status(500).json({
        success: false,
        error: updateResult.error || 'Failed to reset password',
      });
    }

    // Ensure user's email verification status is maintained
    // Get user to check current verification status
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (!listError) {
      const users = listData?.users || [];
      const user = users.find(u => u.email === email);
      if (user) {
        const isVerified = user.user_metadata?.email_verified || false;
        // Update profile to ensure consistency
        await supabase
          .from('profiles')
          .update({ email_verified: isVerified })
          .eq('id', user.id);

        // Log password change
        const userRole = user.user_metadata?.role || 'student';
        await logPasswordChange(user.id, userRole, email);
        // Also log to user_activities
        await logPasswordChangeActivity(req, user.id, userRole, email);
        
        // Log password reset success
        await logPasswordResetSuccess(req, user.id, userRole, email);
      }
    }

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

/**
 * Request admin profile change
 * POST /admin/profile/request-change
 */
export const requestAdminProfileChange = async (req, res) => {
  try {
    const adminUserId = req.user?.sub || req.user?.id;
    const { newEmail, newPassword, confirmNewPassword } = req.body;

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!newEmail && !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a new email or new password',
      });
    }

    if (newPassword && newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    if (newPassword && confirmNewPassword && newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match',
      });
    }

    const authUser = await getAuthUserById(adminUserId);
    if (!authUser) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found',
      });
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from('admins')
      .select('id, user_id, full_name, email, hashed_password, is_active')
      .eq('user_id', adminUserId)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRecord) {
      return res.status(404).json({
        success: false,
        error: 'Admin record not found',
      });
    }

    const currentEmail = normalizeEmail(authUser.email || adminRecord.email);

    const normalizedNewEmail = newEmail ? normalizeEmail(newEmail) : currentEmail;
    const emailChangeRequested = Boolean(newEmail) && normalizedNewEmail !== currentEmail;
    const passwordChangeRequested = Boolean(newPassword);

    if (!emailChangeRequested && !passwordChangeRequested) {
      return res.status(400).json({
        success: false,
        error: 'No changes detected',
      });
    }

    if (emailChangeRequested && !validateAnyEmail(normalizedNewEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address',
      });
    }

    if (emailChangeRequested) {
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw listError;

      const duplicateUser = (authUsers?.users || []).find(
        (existingUser) => existingUser.email === normalizedNewEmail && existingUser.id !== adminUserId,
      );

      const { data: duplicateAdmin, error: duplicateAdminError } = await supabase
        .from('admins')
        .select('user_id')
        .eq('email', normalizedNewEmail)
        .maybeSingle();

      if (duplicateAdminError) throw duplicateAdminError;

      if (duplicateUser || (duplicateAdmin && duplicateAdmin.user_id !== adminUserId)) {
        return res.status(409).json({
          success: false,
          error: 'That email is already in use',
        });
      }

      const otp = generateOTP();
      const encryptedNewPassword = passwordChangeRequested
        ? encryptProfileChangeSecret(newPassword)
        : null;

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const pendingChange = await replacePendingAdminProfileChange({
        adminUserId,
        currentEmail,
        newEmail: normalizedNewEmail,
        encryptedNewPassword,
        expiresAt: expiresAt.toISOString(),
      });

      const otpResult = await saveOTP(normalizedNewEmail, otp, 'admin_profile_change');
      if (!otpResult.success) {
        await supabase
          .from('admin_profile_change_requests')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', pendingChange.id);

        return res.status(500).json({
          success: false,
          error: 'Failed to generate verification code',
        });
      }

      const emailResult = await sendAdminProfileChangeEmail(normalizedNewEmail, otp);
      if (!emailResult.success) {
        await supabase
          .from('email_otps')
          .delete()
          .eq('email', normalizedNewEmail)
          .eq('type', 'admin_profile_change');

        await supabase
          .from('admin_profile_change_requests')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', pendingChange.id);

        return res.status(500).json({
          success: false,
          error: 'Failed to send verification email',
        });
      }

      await logProfileUpdate(req, adminUserId, 'admin', currentEmail, {
        email_change_requested: true,
        newEmail: normalizedNewEmail,
      });

      return res.json({
        success: true,
        verificationRequired: true,
        requestId: pendingChange.id,
        newEmail: normalizedNewEmail,
        message: 'Verification code sent to the new email address.',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(adminUserId, {
      password: newPassword,
      user_metadata: {
        ...authUser.user_metadata,
        email_verified: authUser.email_confirmed_at ? true : Boolean(authUser.user_metadata?.email_verified),
      },
    });

    if (authUpdateError) throw authUpdateError;

    const { error: adminUpdateError } = await supabase
      .from('admins')
      .update({
        hashed_password: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', adminUserId);

    if (adminUpdateError) throw adminUpdateError;

    await logProfileUpdate(req, adminUserId, 'admin', currentEmail, {
      password_changed: true,
    });
    await logPasswordChange(req, adminUserId, 'admin', currentEmail);
    await logPasswordChangeActivity(req, adminUserId, 'admin', currentEmail);

    return res.json({
      success: true,
      verificationRequired: false,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Admin profile change request error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update admin profile',
    });
  }
};

/**
 * Verify admin profile change OTP and apply the update
 * POST /admin/profile/verify-change
 */
export const verifyAdminProfileChange = async (req, res) => {
  try {
    const adminUserId = req.user?.sub || req.user?.id;
    const { requestId, otp } = req.body;

    if (!adminUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    if (!requestId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Verification code and request ID are required',
      });
    }

    const pendingChange = await getPendingAdminProfileChange({
      adminUserId,
      requestId,
    });

    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        error: 'No pending admin profile change found',
      });
    }

    const verificationResult = await verifyOTP(pendingChange.new_email, otp, 'admin_profile_change');
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
      });
    }

    const authUser = await getAuthUserById(adminUserId);
    if (!authUser) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found',
      });
    }

    const decryptedNewPassword = decryptProfileChangeSecret(pendingChange.encrypted_new_password);
    const authUpdatePayload = {
      email: pendingChange.new_email,
      email_confirm: true,
      user_metadata: {
        ...authUser.user_metadata,
        email_verified: true,
        verified_at: new Date().toISOString(),
      },
    };

    if (decryptedNewPassword) {
      authUpdatePayload.password = decryptedNewPassword;
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(adminUserId, authUpdatePayload);
    if (authUpdateError) throw authUpdateError;

    const adminUpdate = {
      email: pendingChange.new_email,
      updated_at: new Date().toISOString(),
    };

    if (decryptedNewPassword) {
      adminUpdate.hashed_password = await bcrypt.hash(decryptedNewPassword, 10);
    }

    const { error: adminUpdateError } = await supabase
      .from('admins')
      .update(adminUpdate)
      .eq('user_id', adminUserId);

    if (adminUpdateError) throw adminUpdateError;

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', adminUserId);

    if (profileUpdateError) {
      console.warn('Profile verification flag update warning:', profileUpdateError.message);
    }

    await completePendingAdminProfileChange(pendingChange.id);

    await logEmailVerificationActivity(req, adminUserId, 'admin', pendingChange.new_email);
    await logProfileUpdate(req, adminUserId, 'admin', pendingChange.current_email, {
      email: {
        from: pendingChange.current_email,
        to: pendingChange.new_email,
      },
      password_changed: Boolean(decryptedNewPassword),
    });

    if (decryptedNewPassword) {
      await logPasswordChange(req, adminUserId, 'admin', pendingChange.new_email);
      await logPasswordChangeActivity(req, adminUserId, 'admin', pendingChange.new_email);
    }

    return res.json({
      success: true,
      message: 'Admin profile updated successfully. Please sign in again with your new credentials.',
      newEmail: pendingChange.new_email,
    });
  } catch (error) {
    console.error('Admin profile verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify admin profile change',
    });
  }
};

