const express = require('express');
const sharing = require('@collabnotes/shared-sharing');
const { addNotification } = require('../lib/notifications');

const router = express.Router();

// POST /api/shares - share note with another user
router.post('/', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const { noteId, userId, canWrite } = req.body || {};
    const result = await sharing.shareNote(parseInt(noteId, 10), ownerId, parseInt(userId, 10), !!canWrite);
    if (result.success) {
      addNotification(Number(userId), `A note was shared with you (note #${noteId})`);
      return res.status(201).json({ success: true, data: result.data });
    }
    return res.apiError(400, 'SHARE_001', result.error || 'Unable to share note');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/shares/shared-with-me
router.get('/shared-with-me', async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const result = await sharing.getSharedNotesForUser(userId);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_002', result.error || 'Unable to load shared notes');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// GET /api/shares/note/:noteId
router.get('/note/:noteId', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const noteId = parseInt(req.params.noteId, 10);
    const result = await sharing.listSharesForNote(noteId, ownerId);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_003', result.error || 'Unable to load note shares');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// PUT /api/shares/:shareId
router.put('/:shareId', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const shareId = parseInt(req.params.shareId, 10);
    const { canWrite } = req.body || {};
    const result = await sharing.updateSharePermission(shareId, ownerId, !!canWrite);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_004', result.error || 'Unable to update share permission');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

// DELETE /api/shares/:shareId
router.delete('/:shareId', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const shareId = parseInt(req.params.shareId, 10);
    const result = await sharing.revokeShare(shareId, ownerId);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_005', result.error || 'Unable to revoke share');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

module.exports = router;
