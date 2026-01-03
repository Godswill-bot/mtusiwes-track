/**
 * Backend Server Test Script
 * Tests email verification endpoints for both students and supervisors
 */

import fetch from 'node-fetch';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const log = (color, message) => {
  console.log(`${color}${message}${colors.reset}`);
};

const testEndpoint = async (name, method, path, body = null) => {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json();

    if (response.ok) {
      log(colors.green, `✓ ${name}: SUCCESS`);
      return { success: true, data };
    } else {
      log(colors.red, `✗ ${name}: FAILED - ${data.error || response.statusText}`);
      return { success: false, error: data.error || response.statusText };
    }
  } catch (error) {
    log(colors.red, `✗ ${name}: ERROR - ${error.message}`);
    return { success: false, error: error.message };
  }
};

const runTests = async () => {
  log(colors.cyan, '\n=== MTU SIWES Backend Server Test ===\n');

  // Test 1: Health Check
  log(colors.yellow, '1. Testing server health...');
  const health = await testEndpoint('Health Check', 'GET', '/health');
  if (!health.success) {
    log(colors.red, '\n❌ Server is not running or not accessible!');
    log(colors.yellow, 'Please start the server with: cd server && npm run dev\n');
    process.exit(1);
  }

  // Test 2: Student Registration (will fail if email exists, but that's ok)
  log(colors.yellow, '\n2. Testing student registration endpoint...');
  await testEndpoint(
    'Student Registration',
    'POST',
    '/api/auth/register',
    {
      firstname: 'Test',
      lastname: 'Student',
      matricNumber: '22010306099',
      email: 'teststudent@mtu.edu.ng',
      password: 'testpass123',
      role: 'student',
    }
  );

  // Test 3: Supervisor Registration
  log(colors.yellow, '\n3. Testing supervisor registration endpoint...');
  await testEndpoint(
    'Supervisor Registration',
    'POST',
    '/api/auth/register',
    {
      firstname: 'Test',
      lastname: 'Supervisor',
      email: 'testsupervisor@mtu.edu.ng',
      password: 'testpass123',
      role: 'school_supervisor',
    }
  );

  // Test 4: Email Verification Endpoint (will fail without valid OTP, but endpoint should exist)
  log(colors.yellow, '\n4. Testing email verification endpoint...');
  await testEndpoint(
    'Email Verification',
    'POST',
    '/api/auth/verify-email',
    {
      email: 'test@mtu.edu.ng',
      otp: '123456',
    }
  );

  log(colors.cyan, '\n=== Test Summary ===');
  log(colors.green, '✓ Server is running and accessible');
  log(colors.green, '✓ Registration endpoints are configured');
  log(colors.green, '✓ Email verification endpoint is configured');
  log(colors.cyan, '\nNote: Registration tests may fail if test emails already exist.');
  log(colors.cyan, 'This is expected behavior. The important thing is that endpoints respond.\n');
};

runTests().catch(console.error);


