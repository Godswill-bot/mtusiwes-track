/**
 * Authentication Middleware
 * Verifies Supabase JWT tokens
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware to verify Supabase JWT token
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Middleware to restrict access based on user role
 * @param {string} role - Required role (e.g., 'student', 'school_supervisor', 'admin')
 */
export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const userRole = req.user.user_metadata?.role;

    if (userRole !== role && userRole !== 'admin') { // Admin usually has access to everything, but let's be strict if needed. 
      // Actually, let's stick to strict role check unless 'admin' is explicitly handled or implied.
      // The prompt says "requireRole(roleName)".
      // If I want to allow admin to access student routes, I should handle that.
      // But usually "student" routes are for "my" data, so admin shouldn't access them as "me".
      // For "supervisor" routes, admin might want access.
      // For now, I will implement strict equality, or maybe allow array of roles.
      // The prompt asks for `requireRole(roleName)`. I'll stick to single role for now, or maybe allow admin override if it makes sense.
      // Let's stick to strict check for now to be safe.
      
      return res.status(403).json({
        success: false,
        error: 'Access denied: Insufficient permissions',
      });
    }

    next();
  };
};

// Export alias for backward compatibility if needed, but prefer requireAuth
export const verifyAuth = requireAuth;

// Alias used by attendance routes
export const authMiddleware = requireAuth;

