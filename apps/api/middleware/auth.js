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
      return res.status(401).json({ error: 'Unauthorized - missing Authorization header' });
    }

    const user = await verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized - invalid token' });

    req.user = user;
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = authMiddleware;
