/**
 * CollabNotes API Server
 * REST API for note management
 */

const express = require('express');
const cors = require('cors');
const { getDb } = require('@collabnotes/shared-database');
const authMiddleware = require('./middleware/auth');
const notesRouter = require('./routes/notes');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount notes router with auth middleware
app.use('/api/notes', authMiddleware, notesRouter);

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await getDb();
    console.log('[API] Database initialized');

    app.listen(PORT, () => {
      console.log(`[API] Server running on http://localhost:${PORT}`);
      console.log(`[API] Health check: GET http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('[API] Startup error', err);
    process.exit(1);
  }
}

start();
