/**
 * Shared Notes Module
 * Core note management with CRUD operations
 * Architectural Units model
 */

const { getDb } = require('@collabnotes/shared-database');

/**
 * Create a new note
 * @param {number} ownerId - User ID of the note owner
 * @param {string} title - Note title
 * @param {string} content - Note content
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function createNote(ownerId, title, content) {
  try {
    if (!ownerId || !title) {
      return { success: false, error: 'ownerId and title are required' };
    }

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO notes (title, content, owner_id) VALUES (?, ?, ?)`,
      [title, content || '', ownerId]
    );

    const note = await db.get(`SELECT * FROM notes WHERE id = ?`, [result.id]);
    return { success: true, data: note };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get a note by ID with permission check
 * @param {number} id - Note ID
 * @param {number} userId - User requesting the note
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getNoteById(id, userId) {
  try {
    if (!id || !userId) {
      return { success: false, error: 'id and userId are required' };
    }

    const db = await getDb();
    const note = await db.get(
      `SELECT * FROM notes WHERE id = ? AND owner_id = ?`,
      [id, userId]
    );

    if (!note) {
      return { success: false, error: 'Note not found or access denied' };
    }

    return { success: true, data: note };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all notes owned by a user
 * @param {number} userId - User ID
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
async function getUserNotes(userId) {
  try {
    if (!userId) {
      return { success: false, error: 'userId is required' };
    }

    const db = await getDb();
    const notes = await db.all(
      `SELECT * FROM notes WHERE owner_id = ? ORDER BY updated_at DESC`,
      [userId]
    );

    return { success: true, data: notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a note (title and/or content)
 * @param {number} id - Note ID
 * @param {number} userId - User updating the note
 * @param {object} updates - Object with title and/or content
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function updateNote(id, userId, updates) {
  try {
    if (!id || !userId || !updates) {
      return { success: false, error: 'id, userId, and updates are required' };
    }

    // Verify ownership
    const db = await getDb();
    const note = await db.get(
      `SELECT * FROM notes WHERE id = ? AND owner_id = ?`,
      [id, userId]
    );

    if (!note) {
      return { success: false, error: 'Note not found or access denied' };
    }

    // Build update query
    const fields = [];
    const values = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);

    const query = `UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`;
    await db.run(query, values);

    const updatedNote = await db.get(`SELECT * FROM notes WHERE id = ?`, [id]);
    return { success: true, data: updatedNote };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a note
 * @param {number} id - Note ID
 * @param {userId} userId - User deleting the note
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteNote(id, userId) {
  try {
    if (!id || !userId) {
      return { success: false, error: 'id and userId are required' };
    }

    // Verify ownership
    const db = await getDb();
    const note = await db.get(
      `SELECT * FROM notes WHERE id = ? AND owner_id = ?`,
      [id, userId]
    );

    if (!note) {
      return { success: false, error: 'Note not found or access denied' };
    }

    await db.run(`DELETE FROM notes WHERE id = ? AND owner_id = ?`, [id, userId]);
    return { success: true, data: { id } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all notes user can access (owned + shared)
 * Note: Shared notes feature to be implemented when sharing module is ready
 * @param {number} userId - User ID
 * @returns {Promise<{success: boolean, data?: array, error?: string}>}
 */
async function getAllNotes(userId) {
  try {
    if (!userId) {
      return { success: false, error: 'userId is required' };
    }

    const db = await getDb();
    // For now, return only owned notes
    // TODO: Join with sharing table when @collabnotes/shared-sharing is implemented
    const notes = await db.all(
      `SELECT * FROM notes WHERE owner_id = ? ORDER BY updated_at DESC`,
      [userId]
    );

    return { success: true, data: notes };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createNote,
  getNoteById,
  getUserNotes,
  updateNote,
  deleteNote,
  getAllNotes,
};
