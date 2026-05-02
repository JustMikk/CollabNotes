const express = require('express');
const notesModule = require('@collabnotes/shared-notes');

const router = express.Router();
const exportUtil = require('@collabnotes/shared-notes/export');

// GET /api/notes - Get all notes (owned + shared)
// Optional query param: ?tag=tagName
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const tag = req.query.tag;
    let result;
    if (tag) result = await notesModule.getNotesByTag(userId, tag);
    else result = await notesModule.getAllNotes(userId);
    if (result.success) return res.json(result.data);
    return res.apiError(400, 'NOTE_004', result.error || 'Unable to fetch notes');
  } catch (err) {
    console.error('[NOTES] GET /', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/notes/:id - Get single note (with permission check)
router.get('/:id', async (req, res, next) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.getNoteById(noteId, userId);
    if (result.success) return res.json(result.data);
    return res.apiError(404, 'NOTE_001', result.error || 'Note not found');
  } catch (err) {
    console.error('[NOTES] GET /:id', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/notes/:id/export?format=json|markdown|text - download exported note
router.get('/:id/export', async (req, res, next) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const fmt = (req.query.format || 'json').toLowerCase();

    const result = await notesModule.getNoteById(noteId, userId);
    if (!result.success) return res.apiError(404, 'NOTE_001', result.error || 'Note not found');
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
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// POST /api/notes - Create new note (requires auth token)
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const { title, content, tags } = req.body;
    const result = await notesModule.createNote(userId, title, content, tags);
    if (result.success) return res.status(201).json(result.data);
    return res.apiError(400, 'NOTE_002', result.error || 'Invalid note payload');
  } catch (err) {
    console.error('[NOTES] POST /', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// PUT /api/notes/:id - Update note (checks write permission)
router.put('/:id', async (req, res, next) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const updates = req.body; // may include title, content, tags

    const result = await notesModule.updateNote(noteId, userId, updates);
    if (result.success) return res.json(result.data);
    return res.apiError(400, 'NOTE_003', result.error || 'Unable to update note');
  } catch (err) {
    console.error('[NOTES] PUT /:id', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// DELETE /api/notes/:id - Delete note (owner only)
router.delete('/:id', async (req, res, next) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.deleteNote(noteId, userId);
    if (result.success) return res.json({ message: 'Note deleted', id: noteId });
    return res.apiError(404, 'NOTE_001', result.error || 'Note not found');
  } catch (err) {
    console.error('[NOTES] DELETE /:id', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/notes/:id/versions - List versions for a note
router.get('/:id/versions', async (req, res, next) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.getNoteVersions(noteId, userId);
    if (result.success) return res.json(result.data);
    return res.apiError(404, 'NOTE_001', result.error || 'Note not found');
  } catch (err) {
    console.error('[NOTES] GET /:id/versions', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// POST /api/notes/:id/versions/:versionId/restore - Restore a version
router.post('/:id/versions/:versionId/restore', async (req, res, next) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);
    const userId = req.user && req.user.id;
    const result = await notesModule.restoreVersion(noteId, versionId, userId);
    if (result.success) return res.json(result.data);
    return res.apiError(400, 'NOTE_005', result.error || 'Unable to restore version');
  } catch (err) {
    console.error('[NOTES] POST /:id/versions/:versionId/restore', err);
    err.code = err.code || 'NOTE_500';
    err.status = err.status || 500;
    next(err);
  }
});

module.exports = router;
