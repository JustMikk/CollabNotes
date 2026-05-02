/**
 * Auth middleware for API
 * Extracts token from Authorization header and verifies via @collabnotes/shared-auth
 */

const { verifyToken } = require('@collabnotes/shared-auth');

async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    // Expect: "Bearer <token>"
    const parts = auth.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : auth || null;

    if (!token) {
      return res.apiError
        ? res.apiError(401, 'AUTH_001', 'Unauthorized - missing Authorization header')
        : res.status(401).json({ success: false, error: { code: 'AUTH_001', message: 'Unauthorized - missing Authorization header' } });
    }

    const user = await verifyToken(token);
    if (!user) {
      return res.apiError
        ? res.apiError(401, 'AUTH_002', 'Unauthorized - invalid token')
        : res.status(401).json({ success: false, error: { code: 'AUTH_002', message: 'Unauthorized - invalid token' } });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    err.code = err.code || 'AUTH_500';
    err.status = err.status || 500;
    err.message = err.message || 'Authentication error';
    next(err);
  }
}

module.exports = authMiddleware;
