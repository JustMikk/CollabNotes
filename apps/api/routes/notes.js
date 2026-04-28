const express = require('express');
const notesModule = require('@collabnotes/shared-notes');

const router = express.Router();
const exportUtil = require('@collabnotes/shared-notes/export');

// GET /api/notes - Get all notes (owned + shared)
// Optional query param: ?tag=tagName
router.get('/', async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const tag = req.query.tag;
    let result;
    if (tag) result = await notesModule.getNotesByTag(userId, tag);
    else result = await notesModule.getAllNotes(userId);
    if (result.success) return res.json(result.data);
    return res.status(400).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] GET /', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notes/:id - Get single note (with permission check)
router.get('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.getNoteById(noteId, userId);
    if (result.success) return res.json(result.data);
    return res.status(404).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] GET /:id', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notes/:id/export?format=json|markdown|text - download exported note
router.get('/:id/export', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const fmt = (req.query.format || 'json').toLowerCase();

    const result = await notesModule.getNoteById(noteId, userId);
    if (!result.success) return res.status(404).json({ error: result.error });
    const note = result.data;

    let body, contentType;
    if (fmt === 'markdown' || fmt === 'md') {
      body = exportUtil.exportToMarkdown(note);
      contentType = 'text/markdown';
    } else if (fmt === 'text' || fmt === 'txt') {
      body = exportUtil.exportToText(note);
      contentType = 'text/plain';
    } else {
      body = exportUtil.exportToJSON(note);
      contentType = 'application/json';
    }

    const filename = exportUtil.filenameFor(note, fmt === 'md' ? 'markdown' : (fmt === 'txt' ? 'text' : fmt));
    res.setHeader('Content-Type', contentType + '; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    console.error('[NOTES] GET /:id/export', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes - Create new note (requires auth token)
router.post('/', async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const { title, content, tags } = req.body;
    const result = await notesModule.createNote(userId, title, content, tags);
    if (result.success) return res.status(201).json(result.data);
    return res.status(400).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] POST /', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notes/:id - Update note (checks write permission)
router.put('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const updates = req.body; // may include title, content, tags

    const result = await notesModule.updateNote(noteId, userId, updates);
    if (result.success) return res.json(result.data);
    return res.status(400).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] PUT /:id', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notes/:id - Delete note (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.deleteNote(noteId, userId);
    if (result.success) return res.json({ message: 'Note deleted', id: noteId });
    return res.status(404).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] DELETE /:id', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notes/:id/versions - List versions for a note
router.get('/:id/versions', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.getNoteVersions(noteId, userId);
    if (result.success) return res.json(result.data);
    return res.status(404).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] GET /:id/versions', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes/:id/versions/:versionId/restore - Restore a version
router.post('/:id/versions/:versionId/restore', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.restoreVersion(noteId, versionId, userId);
    if (result.success) return res.json(result.data);
    return res.status(400).json({ error: result.error });
  } catch (err) {
    console.error('[NOTES] POST /:id/versions/:versionId/restore', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
