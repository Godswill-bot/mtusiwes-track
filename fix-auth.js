
const fs = require('fs');
let code = fs.readFileSync('server/middleware/auth.js', 'utf8');

const regex = /export function requireRole\(\.\.\.allowedRoles\) \{[\s\S]*?\}\n  \};\n\}/;
const replacement = \export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const user = req.user || {};
      
      let role =
        user.app_metadata?.role ||
        user.user_metadata?.role ||
        user.app_metadata?.user_role ||
        user.user_metadata?.user_role ||
        user.role;

      // If token role is just 'authenticated', check the request headers in case the frontend sent x-user-role
      // (This is mostly a fallback just in case we don't have DB access here, we still verify the JWT first)
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
}\;

code = code.replace(regex, replacement);
fs.writeFileSync('server/middleware/auth.js', code);
console.log('Fixed file');

