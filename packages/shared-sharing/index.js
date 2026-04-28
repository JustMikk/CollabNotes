/**
 * Shared Sharing Module
 * Minimal sharing implementation for note collaboration.
 */

let getDb;
try {
	({ getDb } = require('@collabnotes/shared-database'));
} catch (e) {
	({ getDb } = require('../shared-database'));
}

async function shareNote(noteId, ownerId, sharedWithId, canWrite = false) {
	try {
		if (!noteId || !ownerId || !sharedWithId) {
			return { success: false, error: 'noteId, ownerId and sharedWithId are required' };
		}
		const db = await getDb();
		const note = await db.get(`SELECT id FROM notes WHERE id = ? AND owner_id = ?`, [noteId, ownerId]);
		if (!note) return { success: false, error: 'Note not found or access denied' };

		await db.run(
			`INSERT OR REPLACE INTO note_shares (note_id, owner_id, shared_with_id, can_write) VALUES (?, ?, ?, ?)`,
			[noteId, ownerId, sharedWithId, canWrite ? 1 : 0]
		);
		return { success: true, data: { noteId, sharedWithId, canWrite: !!canWrite } };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

async function getSharedNotesForUser(userId) {
	try {
		if (!userId) return { success: false, error: 'userId is required' };
		const db = await getDb();
		const rows = await db.all(
			`SELECT n.*, ns.can_write
			 FROM note_shares ns
			 JOIN notes n ON n.id = ns.note_id
			 WHERE ns.shared_with_id = ?
			 ORDER BY n.updated_at DESC`,
			[userId]
		);
		return { success: true, data: rows };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

async function canRead(noteId, userId) {
	try {
		const db = await getDb();
		const row = await db.get(`SELECT id FROM note_shares WHERE note_id = ? AND shared_with_id = ?`, [noteId, userId]);
		return !!row;
	} catch (error) {
		return false;
	}
}

async function canWrite(noteId, userId) {
	try {
		const db = await getDb();
		const row = await db.get(
			`SELECT id FROM note_shares WHERE note_id = ? AND shared_with_id = ? AND can_write = 1`,
			[noteId, userId]
		);
		return !!row;
	} catch (error) {
		return false;
	}
}

async function listSharesForNote(noteId, ownerId) {
  try {
    if (!noteId || !ownerId) return { success: false, error: 'noteId and ownerId are required' };
    const db = await getDb();
    const note = await db.get(`SELECT id FROM notes WHERE id = ? AND owner_id = ?`, [noteId, ownerId]);
    if (!note) return { success: false, error: 'Note not found or access denied' };
    const rows = await db.all(`SELECT * FROM note_shares WHERE note_id = ? ORDER BY created_at DESC`, [noteId]);
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateSharePermission(shareId, ownerId, canWriteValue) {
  try {
    if (!shareId || !ownerId) return { success: false, error: 'shareId and ownerId are required' };
    const db = await getDb();
    const share = await db.get(`SELECT * FROM note_shares WHERE id = ? AND owner_id = ?`, [shareId, ownerId]);
    if (!share) return { success: false, error: 'Share not found or access denied' };
    await db.run(`UPDATE note_shares SET can_write = ? WHERE id = ?`, [canWriteValue ? 1 : 0, shareId]);
    const updated = await db.get(`SELECT * FROM note_shares WHERE id = ?`, [shareId]);
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function revokeShare(shareId, ownerId) {
  try {
    if (!shareId || !ownerId) return { success: false, error: 'shareId and ownerId are required' };
    const db = await getDb();
    const share = await db.get(`SELECT * FROM note_shares WHERE id = ? AND owner_id = ?`, [shareId, ownerId]);
    if (!share) return { success: false, error: 'Share not found or access denied' };
    await db.run(`DELETE FROM note_shares WHERE id = ?`, [shareId]);
    return { success: true, data: { id: shareId } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
	shareNote,
	getSharedNotesForUser,
	canRead,
	canWrite,
  listSharesForNote,
  updateSharePermission,
  revokeShare,
};
