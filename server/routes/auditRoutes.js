/**
 * Audit Logging Routes
 * Handles audit logging from frontend
 */

import express from 'express';
import {
  createAuditLog,
  logProfileUpdate,
} from '../lib/audit.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Log profile update
 * POST /api/audit/profile-update
 */
router.post('/profile-update', async (req, res) => {
  try {
    const { userId, userType, userEmail, tableName, recordId, oldValue, newValue, changes } = req.body;

    if (!userId || !tableName || !changes || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await logProfileUpdate(
      userId,
      userType || 'student',
      userEmail,
      tableName,
      recordId,
      oldValue,
      newValue,
      changes
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Audit log created',
    });
  } catch (error) {
    console.error('Profile update audit error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;

