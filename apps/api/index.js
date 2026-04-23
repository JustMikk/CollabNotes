/**
 * CollabNotes API Server
 * REST API for note management
 */

const express = require('express');
const cors = require('cors');
const { getDb } = require('@collabnotes/shared-database');
const authMiddleware = require('./middleware/auth');
const notesRouter = require('./routes/notes');
const authRouter = require('./routes/auth');
const sharingRouter = require('./routes/sharing');
const searchModule = require('@collabnotes/shared-search');
const notifications = require('./lib/notifications');

const app = express();
const PORT = 3001;

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 100;

app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    console.log(`[REQ] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Standard API error helper
app.use((req, res, next) => {
  res.apiError = (status, code, message, details) => {
    const body = { success: false, error: { code, message } };
    if (details) body.error.details = details;
    return res.status(status).json(body);
  };
  next();
});

// Simple in-memory rate limiter by IP (100 requests/minute)
app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const existing = rateLimitStore.get(ip) || [];
  const recent = existing.filter((ts) => ts > windowStart);
  recent.push(now);
  rateLimitStore.set(ip, recent);

  if (recent.length > RATE_LIMIT_MAX) {
    return res.apiError(429, 'RATE_LIMIT', 'Too many requests');
  }

  // Opportunistic cleanup to avoid unbounded memory growth
  if (rateLimitStore.size > 5000) {
    for (const [key, timestamps] of rateLimitStore.entries()) {
      const keep = timestamps.filter((ts) => ts > windowStart);
      if (keep.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, keep);
    }
  }

  next();
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

// Mount notes router with auth middleware
app.use('/api/notes', authMiddleware, sharingRouter);
app.use('/api/notes', authMiddleware, notesRouter);

// GET /api/search?q=query
app.get('/api/search', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const query = String(req.query.q || '').trim();
    if (!query) return res.apiError(400, 'SEARCH_001', 'Query parameter q is required');
    const result = await searchModule.searchNotes(userId, query);
    if (result.success) return res.json(result.data);
    return res.apiError(400, 'SEARCH_002', result.error || 'Unable to search notes');
  } catch (err) {
    console.error('[SEARCH] GET /api/search', err);
    next(err);
  }
});

app.get('/api/notifications', authMiddleware, (req, res) => {
  const userId = req.user.id;
  res.json({ success: true, data: notifications.getNotifications(userId) });
});

app.post('/api/notifications/:id/read', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  notifications.markRead(userId, id);
  res.json({ success: true, data: { id } });
});

// GET /api/tags - return all unique tags for user
app.get('/api/tags', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const result = await require('@collabnotes/shared-notes').getAllTags(userId);
    if (result.success) return res.json(result.data);
    return res.apiError(400, 'TAGS_001', result.error || 'Unable to fetch tags');
  } catch (err) {
    console.error('[TAGS] GET /api/tags', err);
    next(err);
  }
});

// 404 handler for unknown routes
app.use((req, res) => {
  return res.apiError(404, 'ROUTE_404', 'Route not found');
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);
  if (res.headersSent) return next(err);
  const code = err && err.code ? String(err.code) : 'INTERNAL_ERROR';
  const message = err && err.message ? err.message : 'Internal server error';
  const status = err && err.status ? err.status : 500;
  return res.apiError(status, code, message);
});

async function start() {
  try {
    await getDb();
    console.log('[API] Database initialized');

    const server = app.listen(PORT, () => {
      console.log(`[API] Server running on http://localhost:${PORT}`);
      console.log(`[API] Health check: GET http://localhost:${PORT}/health`);
    });
    return server;
  } catch (err) {
    console.error('[API] Startup error', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start,
};
