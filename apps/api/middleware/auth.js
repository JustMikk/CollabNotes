/**
 * Auth middleware for API
 * Extracts token from Authorization header and verifies via @collabnotes/shared-auth
 */

const { authenticateToken } = require('@collabnotes/shared-auth');

async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    // Expect: "Bearer <token>"
    const parts = auth.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : auth || null;

    if (!token) {
      return res.apiError
        ? res.apiError(401, 'AUTH_004', 'Unauthorized - missing Authorization header')
        : res.status(401).json({
            success: false,
            error: { code: 'AUTH_004', message: 'Unauthorized - missing Authorization header' },
          });
    }

    const result = await authenticateToken(token);
    if (!result.success) {
      const code = result.error && result.error.code ? result.error.code : 'AUTH_004';
      const message =
        result.error && result.error.message ? result.error.message : 'Unauthorized - invalid token';
      return res.apiError
        ? res.apiError(401, code, message)
        : res.status(401).json({ success: false, error: { code, message } });
    }

    req.user = result.data;
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
