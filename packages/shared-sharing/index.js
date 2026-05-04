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

module.exports = {
	shareNote,
	getSharedNotesForUser,
	canRead,
	canWrite,
};
