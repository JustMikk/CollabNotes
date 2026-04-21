/**
 * Shared Sharing Module
 * Sharing and permission management for notes.
 */

let getDb;
try {
	({ getDb } = require('@collabnotes/shared-database'));
} catch (e) {
	({ getDb } = require('../shared-database'));
}

function normalizePermission(permission) {
  if (!permission) return null;
  const normalized = String(permission).toLowerCase();
  if (normalized === 'read' || normalized === 'write') return normalized;
  return null;
}

async function resolveTargetUserId(targetUsernameOrEmail) {
  const db = await getDb();
  if (typeof targetUsernameOrEmail === 'number') {
    const row = await db.get(`SELECT id FROM users WHERE id = ?`, [targetUsernameOrEmail]);
    return row ? row.id : null;
  }

  const target = String(targetUsernameOrEmail || '').trim();
  if (!target) return null;

  const row = await db.get(`SELECT id FROM users WHERE username = ? OR email = ?`, [target, target]);
  return row ? row.id : null;
}

async function shareNote(noteId, ownerId, targetUsernameOrEmail, permission) {
  try {
    const normalizedPermission = normalizePermission(permission);
    if (!noteId || !ownerId || !targetUsernameOrEmail || !normalizedPermission) {
      return { success: false, error: 'noteId, ownerId, target user, and permission (read/write) are required' };
    }

    const db = await getDb();
    const note = await db.get(`SELECT id FROM notes WHERE id = ? AND owner_id = ?`, [noteId, ownerId]);
    if (!note) return { success: false, error: 'Note not found or access denied' };

    const targetUserId = await resolveTargetUserId(targetUsernameOrEmail);
    if (!targetUserId) return { success: false, error: 'Target user not found' };
    if (Number(targetUserId) === Number(ownerId)) {
      return { success: false, error: 'Owner already has full access' };
    }

    const existing = await db.get(`SELECT id FROM shares WHERE note_id = ? AND user_id = ?`, [noteId, targetUserId]);
    if (existing) {
      await db.run(`UPDATE shares SET permission = ? WHERE id = ?`, [normalizedPermission, existing.id]);
    } else {
      await db.run(`INSERT INTO shares (note_id, user_id, permission) VALUES (?, ?, ?)`, [
        noteId,
        targetUserId,
        normalizedPermission,
      ]);
    }

    return {
      success: true,
      data: { noteId: Number(noteId), userId: Number(targetUserId), permission: normalizedPermission },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getNoteAccessList(noteId, ownerId) {
  try {
    if (!noteId || !ownerId) return { success: false, error: 'noteId and ownerId are required' };
    const db = await getDb();
    const note = await db.get(`SELECT id FROM notes WHERE id = ? AND owner_id = ?`, [noteId, ownerId]);
    if (!note) return { success: false, error: 'Note not found or access denied' };

    const rows = await db.all(
      `SELECT s.user_id, s.permission, s.created_at, u.username, u.email
       FROM shares s
       JOIN users u ON u.id = s.user_id
       WHERE s.note_id = ?
       ORDER BY s.created_at DESC`,
      [noteId]
    );
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function revokeAccess(noteId, ownerId, targetUserId) {
  try {
    if (!noteId || !ownerId || !targetUserId) {
      return { success: false, error: 'noteId, ownerId and targetUserId are required' };
    }
    const db = await getDb();
    const note = await db.get(`SELECT id FROM notes WHERE id = ? AND owner_id = ?`, [noteId, ownerId]);
    if (!note) return { success: false, error: 'Note not found or access denied' };

    const result = await db.run(`DELETE FROM shares WHERE note_id = ? AND user_id = ?`, [noteId, targetUserId]);
    if (!result.changes) return { success: false, error: 'No access record found to revoke' };
    return { success: true, data: { noteId: Number(noteId), userId: Number(targetUserId) } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getUserPermission(noteId, userId) {
  try {
    if (!noteId || !userId) return null;
    const db = await getDb();

    const ownerNote = await db.get(`SELECT id FROM notes WHERE id = ? AND owner_id = ?`, [noteId, userId]);
    if (ownerNote) return 'write';

    const row = await db.get(`SELECT permission FROM shares WHERE note_id = ? AND user_id = ?`, [noteId, userId]);
    if (!row) return null;
    const permission = normalizePermission(row.permission);
    return permission || null;
  } catch (error) {
    return null;
  }
}

async function getNotesSharedWithUser(userId) {
  try {
    if (!userId) return { success: false, error: 'userId is required' };
    const db = await getDb();
    const rows = await db.all(
      `SELECT n.*, s.permission
       FROM shares s
       JOIN notes n ON n.id = s.note_id
       WHERE s.user_id = ?
       ORDER BY n.updated_at DESC`,
      [userId]
    );
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Backward-compatible helpers used by existing modules/routes.
async function getSharedNotesForUser(userId) {
  return getNotesSharedWithUser(userId);
}

async function canRead(noteId, userId) {
  const permission = await getUserPermission(noteId, userId);
  return permission === 'read' || permission === 'write';
}

async function canWrite(noteId, userId) {
  const permission = await getUserPermission(noteId, userId);
  return permission === 'write';
}

async function listSharesForNote(noteId, ownerId) {
  return getNoteAccessList(noteId, ownerId);
}

async function updateSharePermission(shareId, ownerId, canWriteValue) {
  try {
    if (!shareId || !ownerId) return { success: false, error: 'shareId and ownerId are required' };
    const db = await getDb();
    const row = await db.get(
      `SELECT s.id, s.note_id
       FROM shares s
       JOIN notes n ON n.id = s.note_id
       WHERE s.id = ? AND n.owner_id = ?`,
      [shareId, ownerId]
    );
    if (!row) return { success: false, error: 'Share not found or access denied' };
    const permission = canWriteValue ? 'write' : 'read';
    await db.run(`UPDATE shares SET permission = ? WHERE id = ?`, [permission, shareId]);
    const updated = await db.get(`SELECT * FROM shares WHERE id = ?`, [shareId]);
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function revokeShare(shareId, ownerId) {
  try {
    if (!shareId || !ownerId) return { success: false, error: 'shareId and ownerId are required' };
    const db = await getDb();
    const row = await db.get(
      `SELECT s.id, s.note_id
       FROM shares s
       JOIN notes n ON n.id = s.note_id
       WHERE s.id = ? AND n.owner_id = ?`,
      [shareId, ownerId]
    );
    if (!row) return { success: false, error: 'Share not found or access denied' };
    await db.run(`DELETE FROM shares WHERE id = ?`, [shareId]);
    return { success: true, data: { id: shareId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  shareNote,
  getNoteAccessList,
  revokeAccess,
  getUserPermission,
  getNotesSharedWithUser,
  getSharedNotesForUser,
  canRead,
  canWrite,
  listSharesForNote,
  updateSharePermission,
  revokeShare,
};
