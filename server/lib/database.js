/**
 * Database Service Module
 * Handles all database operations for OTP and user verification
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
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Save OTP to database
 * @param {string} email - User email
 * @param {string} otp - 6-digit OTP
 * @param {string} type - 'verification' or 'reset'
 * @returns {Promise<Object>} - Database result
 */
export const saveOTP = async (email, otp, type = 'verification') => {
  try {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

    // Delete any existing OTPs for this email and type
    await supabase
      .from('email_otps')
      .delete()
      .eq('email', email)
      .eq('type', type);

    // Insert new OTP
    const { data, error } = await supabase
      .from('email_otps')
      .insert({
        email,
        otp,
        type,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error saving OTP:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verify OTP from database
 * @param {string} email - User email
 * @param {string} otp - 6-digit OTP to verify
 * @param {string} type - 'verification' or 'reset'
 * @returns {Promise<Object>} - Verification result
 */
export const verifyOTP = async (email, otp, type = 'verification') => {
  try {
    const { data, error } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', email)
      .eq('otp', otp)
      .eq('type', type)
      .single();

    if (error) {
      return {
        success: false,
        error: 'Invalid or expired OTP',
      };
    }

    // Check if OTP has expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      // Delete expired OTP
      await supabase
        .from('email_otps')
        .delete()
        .eq('id', data.id);

      return {
        success: false,
        error: 'OTP has expired. Please request a new one.',
      };
    }

    // Delete used OTP
    await supabase
      .from('email_otps')
      .delete()
      .eq('id', data.id);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check if email exists in users table
 * @param {string} email - Email to check
 * @returns {Promise<Object>} - Check result
 */
export const checkEmailExists = async (email) => {
  try {
    // Check in auth.users via Supabase Admin API
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) throw error;

    const userExists = users.some(user => user.email === email);

    return {
      success: true,
      exists: userExists,
    };
  } catch (error) {
    console.error('Error checking email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Mark user as verified in database
 * @param {string} email - User email
 * @returns {Promise<Object>} - Update result
 */
export const markUserAsVerified = async (email) => {
  try {
    // Get user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Update user metadata to mark as verified
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          email_verified: true,
          verified_at: new Date().toISOString(),
        },
      }
    );

    if (error) throw error;

    // Also update profiles table if it exists
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', user.id);

    // Profile update error is not critical, so we continue

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error marking user as verified:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Update user password
 * @param {string} email - User email
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - Update result
 */
export const updateUserPassword = async (email, newPassword) => {
  try {
    // Get user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Preserve email verification status when updating password
    const currentMetadata = user.user_metadata || {};
    
    // Check both user_metadata and profiles table for verification status
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .maybeSingle();
    
    // User is verified if either source says so (preserve existing verification)
    const isEmailVerified = currentMetadata.email_verified || profile?.email_verified || false;

    // Update password using Supabase Admin API, preserving email_verified status
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        user_metadata: {
          ...currentMetadata,
          email_verified: isEmailVerified, // Preserve verification status
        },
      }
    );

    if (error) throw error;

    // Also ensure profile table has email_verified set (maintain consistency)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ email_verified: isEmailVerified })
      .eq('id', user.id);

    // Profile update error is not critical, so we continue

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error updating password:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  generateOTP,
  saveOTP,
  verifyOTP,
  checkEmailExists,
  markUserAsVerified,
  updateUserPassword,
};




