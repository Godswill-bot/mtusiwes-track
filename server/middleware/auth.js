/**
 * Authentication Middleware
 * JWT decode only (NO Supabase, NO jsonwebtoken)
 * Exports:
 *  - requireAuth
 *  - verifyAuth (alias)
 *  - authMiddleware (alias)
 *  - requireRole
 */

function decodeBearerToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );
    return payload;
  } catch {
    return null;
  }
}

// Main auth middleware
export function requireAuth(req, res, next) {
  try {
    const decoded = decodeBearerToken(req);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('requireAuth error:', error);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }
}

// Aliases so older imports keep working
export const verifyAuth = requireAuth;
export const authMiddleware = requireAuth;

/**
 * Role guard middleware
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      const user = req.user || {};
      let role =
        user.app_metadata?.role ||
        user.user_metadata?.role ||
        user.app_metadata?.user_role ||
        user.user_metadata?.user_role ||
        user.role;

      // Allow frontend to pass the validated role if the token only contains 'authenticated'
      if (role === 'authenticated' && req.headers['x-user-role']) {
        role = req.headers['x-user-role'];
      }

      if (!role) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: role missing',
        });
      }

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: insufficient role',
        });
      }

      next();
    } catch (error) {
      console.error('requireRole error:', error);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      });
    }
  };
}
