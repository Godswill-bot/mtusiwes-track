/**
 * Email Service Module
 * Handles all email sending operations using Nodemailer with Gmail
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (16-digit)
  },
});

/**
 * Verify transporter configuration
 */
export const verifyEmailConfig = async () => {
  try {
    // Add timeout to prevent hanging
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email verification timeout')), 10000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('✓ Email server is ready to send messages');
    return true;
  } catch (error) {
    if (error.message === 'Email verification timeout') {
      console.warn('⚠ Email verification timed out (server will still start)');
      console.warn('  Check your EMAIL_USER and EMAIL_PASS in .env file');
      return false;
    }
    console.error('✗ Email server configuration error:', error.message);
    console.warn('⚠ Server will start anyway, but emails may not work');
    return false;
  }
};

/**
 * Send email using Nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text email body
 * @param {string} html - HTML email body (optional)
 * @returns {Promise<Object>} - Send result
 */
export const sendEmail = async (to, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: `"MTU SIWES Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text, // Use HTML if provided, otherwise use plain text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send OTP verification email
 * @param {string} to - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} type - 'verification' or 'reset'
 * @returns {Promise<Object>} - Send result
 */
export const sendOTPEmail = async (to, otp, type = 'verification') => {
  const subject = type === 'verification'
    ? 'MTU SIWES Email Verification Code'
    : 'Your SIWES Password Reset Code';

  const text = type === 'verification'
    ? `Your MTU SIWES email verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.`
    : `Your MTU SIWES password reset code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.`;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const verificationUrl = type === 'verification' 
    ? `${frontendUrl}/student/verify-email?email=${encodeURIComponent(to)}`
    : `${frontendUrl}/forgot-password?email=${encodeURIComponent(to)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">MTU SIWES Platform</h1>
      </div>
      <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">${type === 'verification' ? 'Email Verification' : 'Password Reset'}</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          ${type === 'verification' 
            ? 'Thank you for registering with MTU SIWES Platform. Please verify your email address using the code below:'
            : 'You have requested to reset your password. Use the code below to proceed:'}
        </p>
        <div style="background-color: white; border: 2px dashed #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="font-size: 32px; font-weight: bold; color: #7c3aed; letter-spacing: 8px; margin: 0;">
            ${otp}
          </p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Continue to Verification
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px; text-align: center;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 10px; text-align: center;">
          If you did not request this ${type === 'verification' ? 'verification' : 'password reset'}, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} Mountain Top University. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(to, subject, text, html);
};

/**
 * Send password reset email with current password info and reset link
 * @param {string} to - Recipient email address
 * @param {string} resetLink - Password reset link with OTP
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<Object>} - Send result
 */
export const sendPasswordResetEmail = async (to, resetLink, otp) => {
  const subject = 'MTU SIWES Password Reset Request';

  const text = `Dear MTU SIWES User,

You have requested to reset your password for your MTU SIWES account.

Your password reset code is: ${otp}

To reset your password, click on the following link:
${resetLink}

Alternatively, you can use the code above on the password reset page.

IMPORTANT SECURITY NOTES:
- This code will expire in 10 minutes.
- If you did not request this password reset, please ignore this email.
- For security reasons, we cannot send your current password via email.
- If you remember your password, you can continue using it.

If you have any concerns, please contact the SIWES administrator.

Best regards,
MTU SIWES Platform`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">MTU SIWES Platform</h1>
      </div>
      <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          You have requested to reset your password for your MTU SIWES account.
        </p>
        
        <div style="background-color: white; border: 2px solid #7c3aed; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #1f2937; font-weight: bold; margin-top: 0;">Your Password Reset Code:</p>
          <div style="background-color: #f3f4f6; border: 2px dashed #7c3aed; border-radius: 8px; padding: 20px; text-align: center; margin: 10px 0;">
            <p style="font-size: 32px; font-weight: bold; color: #7c3aed; letter-spacing: 8px; margin: 0;">
              ${otp}
            </p>
          </div>
        </div>

        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #1f2937; font-weight: bold; margin-top: 0;">Reset Your Password:</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0;">
            Click here to reset your password
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 10px; word-break: break-all;">
            Or copy and paste this link into your browser:<br>
            <span style="color: #7c3aed;">${resetLink}</span>
          </p>
        </div>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #92400e; font-weight: bold; margin-top: 0;">⚠️ Important Security Notes:</p>
          <ul style="color: #78350f; margin: 10px 0; padding-left: 20px;">
            <li>This code will expire in <strong>10 minutes</strong>.</li>
            <li>If you did not request this password reset, please ignore this email.</li>
            <li>For security reasons, we cannot send your current password via email.</li>
            <li>If you remember your password, you can continue using it.</li>
          </ul>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          If you have any concerns, please contact the SIWES administrator.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} Mountain Top University. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return await sendEmail(to, subject, text, html);
};

export default {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  verifyEmailConfig,
};

