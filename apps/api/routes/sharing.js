const express = require('express');
const sharing = require('@collabnotes/shared-sharing');

const router = express.Router();

// POST /api/notes/:id/share
router.post('/:id/share', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const noteId = parseInt(req.params.id, 10);
    const { username, permission } = req.body || {};
    const result = await sharing.shareNote(noteId, ownerId, username, permission);
    if (result.success) {
      return res.status(201).json({ success: true, data: result.data });
    }
    return res.apiError(400, 'SHARE_001', result.error || 'Unable to share note');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/notes/shared
router.get('/shared', async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const result = await sharing.getNotesSharedWithUser(userId);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_002', result.error || 'Unable to load shared notes');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/notes/:id/shares
router.get('/:id/shares', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const noteId = parseInt(req.params.id, 10);
    const result = await sharing.getNoteAccessList(noteId, ownerId);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_003', result.error || 'Unable to load note shares');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// DELETE /api/notes/:id/shares/:userId
router.delete('/:id/shares/:userId', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const noteId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const result = await sharing.revokeAccess(noteId, ownerId, targetUserId);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_004', result.error || 'Unable to revoke access');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

module.exports = router;
