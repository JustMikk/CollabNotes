const express = require('express');
const sharing = require('@collabnotes/shared-sharing');

const router = express.Router();

// POST /api/shares - share note with another user
router.post('/', async (req, res, next) => {
  try {
    const ownerId = req.user && req.user.id;
    const { noteId, userId, canWrite } = req.body || {};
    const result = await sharing.shareNote(parseInt(noteId, 10), ownerId, parseInt(userId, 10), !!canWrite);
    if (result.success) return res.status(201).json({ success: true, data: result.data });
    return res.apiError(400, 'SHARE_001', result.error || 'Unable to share note');
  } catch (err) {
    err.code = err.code || 'SHARE_500';
    err.status = err.status || 500;
    next(err);
  }
});

module.exports = router;
