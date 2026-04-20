/**
 * CollabNotes API Server
 * REST API for note management
 */

const express = require('express');
const cors = require('cors');
const { getDb } = require('@collabnotes/shared-database');
const notesModule = require('@collabnotes/shared-notes');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware placeholder
// TODO: Implement proper JWT/session authentication
function authMiddleware(req, res, next) {
  // For now, extract userId from headers for testing
  // In production, verify JWT token
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized - provide x-user-id header' });
  }
  req.userId = parseInt(userId);
  next();
}

// ============================================
// Health Check
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Notes Routes
// ============================================

/**
 * Create a new note
 * POST /api/notes
 * Body: { title, content }
 */
app.post('/api/notes', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await notesModule.createNote(req.userId, title, content);

    if (result.success) {
      res.status(201).json(result.data);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all notes for current user
 * GET /api/notes
 */
app.get('/api/notes', authMiddleware, async (req, res) => {
  try {
    const result = await notesModule.getAllNotes(req.userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific note
 * GET /api/notes/:id
 */
app.get('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const result = await notesModule.getNoteById(noteId, req.userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a note
 * PUT /api/notes/:id
 * Body: { title?, content? }
 */
app.put('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const updates = req.body;
    const result = await notesModule.updateNote(noteId, req.userId, updates);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a note
 * DELETE /api/notes/:id
 */
app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const result = await notesModule.deleteNote(noteId, req.userId);

    if (result.success) {
      res.json({ message: 'Note deleted', id: noteId });
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Error Handling
// ============================================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// Server Startup
// ============================================

async function start() {
  try {
    // Initialize database
    await getDb();
    console.log('[API] Database initialized');

    // Start server
    app.listen(PORT, () => {
      console.log(`[API] Server running on http://localhost:${PORT}`);
      console.log(`[API] Health check: GET http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[API] Startup error:', error);
    process.exit(1);
  }
}

start();
