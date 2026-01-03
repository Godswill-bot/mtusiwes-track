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
import { sendOTPEmail } from '../lib/email.js';
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
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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

        // Automatically assign student to a random school supervisor
        try {
          const { error: assignmentError } = await supabase.rpc(
            'assign_student_to_school_supervisor',
            { p_student_id: insertedStudent.id }
          );

          if (assignmentError) {
            console.error('Error assigning supervisor during registration:', assignmentError);
            // Don't block registration if assignment fails
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
      const { data: { users } } = await supabase.auth.admin.listUsers();
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
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

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

    // Get user from Supabase Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (!user) {
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
    const { sendPasswordResetEmail } = await import('../lib/email.js');
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
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (!listError) {
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

