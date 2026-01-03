/**
 * Test script to verify backend email verification endpoints
 * Run with: node test-email-verification.js
 */

import dotenv from 'dotenv';
import { verifyEmailConfig, sendOTPEmail } from './lib/email.js';
import { generateOTP, saveOTP, verifyOTP, checkEmailExists, markUserAsVerified } from './lib/database.js';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@mtu.edu.ng';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  MTU SIWES Email Verification Backend Test              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function testEmailConfig() {
  console.log('1. Testing Email Configuration...');
  const emailReady = await verifyEmailConfig();
  if (emailReady) {
    console.log('   ✓ Email server is ready\n');
    return true;
  } else {
    console.log('   ✗ Email server configuration failed\n');
    return false;
  }
}

async function testOTPGeneration() {
  console.log('2. Testing OTP Generation...');
  const otp = generateOTP();
  if (otp && otp.length === 6 && /^\d{6}$/.test(otp)) {
    console.log(`   ✓ OTP generated: ${otp}\n`);
    return otp;
  } else {
    console.log('   ✗ OTP generation failed\n');
    return null;
  }
}

async function testOTPSave(email, otp) {
  console.log('3. Testing OTP Save to Database...');
  const result = await saveOTP(email, otp, 'verification');
  if (result.success) {
    console.log('   ✓ OTP saved to database\n');
    return true;
  } else {
    console.log(`   ✗ OTP save failed: ${result.error}\n`);
    return false;
  }
}

async function testOTPVerify(email, otp) {
  console.log('4. Testing OTP Verification...');
  const result = await verifyOTP(email, otp, 'verification');
  if (result.success) {
    console.log('   ✓ OTP verified successfully\n');
    return true;
  } else {
    console.log(`   ✗ OTP verification failed: ${result.error}\n`);
    return false;
  }
}

async function testEmailSending(email, otp) {
  console.log('5. Testing Email Sending...');
  const result = await sendOTPEmail(email, otp, 'verification');
  if (result.success) {
    console.log(`   ✓ Email sent successfully (Message ID: ${result.messageId})\n`);
    return true;
  } else {
    console.log(`   ✗ Email sending failed: ${result.error}\n`);
    return false;
  }
}

async function testEmailExists(email) {
  console.log('6. Testing Email Existence Check...');
  const result = await checkEmailExists(email);
  if (result.success) {
    console.log(`   ✓ Email check completed (exists: ${result.exists})\n`);
    return result.exists;
  } else {
    console.log(`   ✗ Email check failed: ${result.error}\n`);
    return null;
  }
}

async function testBackendAPI() {
  console.log('7. Testing Backend API Endpoints...');
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✓ Backend server is running: ${data.status}\n`);
      return true;
    } else {
      console.log(`   ✗ Backend server returned error: ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.log(`   ✗ Backend server is not running: ${error.message}\n`);
    console.log('   → To start the server, run: npm run dev\n');
    return false;
  }
}

async function runAllTests() {
  const results = {
    emailConfig: false,
    otpGeneration: false,
    otpSave: false,
    otpVerify: false,
    emailSending: false,
    emailExists: false,
    backendAPI: false,
  };

  // Test 1: Email Configuration
  results.emailConfig = await testEmailConfig();

  // Test 2: OTP Generation
  const otp = await testOTPGeneration();
  results.otpGeneration = otp !== null;

  if (otp) {
    // Test 3: OTP Save
    results.otpSave = await testOTPSave(TEST_EMAIL, otp);

    // Test 4: OTP Verify
    results.otpVerify = await testOTPVerify(TEST_EMAIL, otp);
  }

  // Test 5: Email Sending (only if email config is ready)
  if (results.emailConfig && otp) {
    results.emailSending = await testEmailSending(TEST_EMAIL, otp);
  }

  // Test 6: Email Existence Check
  results.emailExists = await testEmailExists(TEST_EMAIL) !== null;

  // Test 7: Backend API
  results.backendAPI = await testBackendAPI();

  // Summary
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Email Configuration:     ${results.emailConfig ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log(`║  OTP Generation:          ${results.otpGeneration ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log(`║  OTP Save:                ${results.otpSave ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log(`║  OTP Verification:        ${results.otpVerify ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log(`║  Email Sending:           ${results.emailSending ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log(`║  Email Existence Check:    ${results.emailExists ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log(`║  Backend API:             ${results.backendAPI ? '✓ PASS' : '✗ FAIL'}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('✓ All tests passed! Email verification system is working correctly.\n');
  } else {
    console.log('✗ Some tests failed. Please check the errors above.\n');
    console.log('Common issues:');
    if (!results.emailConfig) {
      console.log('  - Check EMAIL_USER and EMAIL_PASS in .env file');
    }
    if (!results.backendAPI) {
      console.log('  - Start the backend server: cd server && npm run dev');
    }
    if (!results.otpSave || !results.otpVerify) {
      console.log('  - Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
      console.log('  - Ensure email_otps table exists in Supabase');
    }
  }

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});

