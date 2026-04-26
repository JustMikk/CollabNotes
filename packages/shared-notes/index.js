/**
 * Shared Notes Module
 * Core note management with CRUD operations
 * Architectural Units model
 */

const { getDb } = require('@collabnotes/shared-database');

function normalizeTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean);
  if (typeof input === 'string') {
    // Accept JSON array string or comma-separated
    const trimmed = input.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
      } catch (e) {
        // fallthrough
      }
    }
    return trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

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
    const tagsArr = normalizeTags(arguments[3] || (typeof arguments[2] === 'object' && arguments[2] ? arguments[2].tags : undefined)) || [];
    // If caller passed content as third arg and tags separately, we support explicit param order in future.
    // For now callers should pass (ownerId, title, content, tags)
    const tagsJson = JSON.stringify(tagsArr);

    const result = await db.run(
      `INSERT INTO notes (title, content, owner_id, tags) VALUES (?, ?, ?, ?)`,
      [title, content || '', ownerId, tagsJson]
    );

    const note = await db.get(`SELECT * FROM notes WHERE id = ?`, [result.id]);
    if (note && note.tags) {
      try { note.tags = JSON.parse(note.tags); } catch (e) { note.tags = []; }
    }
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

    if (note && note.tags) {
      try { note.tags = JSON.parse(note.tags); } catch (e) { note.tags = []; }
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
    const parsed = notes.map((n) => {
      if (n && n.tags) {
        try { n.tags = JSON.parse(n.tags); } catch (e) { n.tags = []; }
      } else {
        n.tags = [];
      }
      return n;
    });

    return { success: true, data: parsed };
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

      // Save previous version before applying updates
      try {
        await db.run(
          `INSERT INTO note_versions (note_id, title, content, updated_by) VALUES (?, ?, ?, ?)`,
          [id, note.title, note.content, userId]
        );
      } catch (e) {
        // Non-fatal: continue if versions table isn't available
        console.warn('[NOTES] Could not write note_versions entry:', e && e.message);
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

    if (updates.tags !== undefined) {
      const tagsArr = normalizeTags(updates.tags);
      fields.push('tags = ?');
      values.push(JSON.stringify(tagsArr));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    // Append WHERE params after SET values
    values.push(id, userId);

    const query = `UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`;
    await db.run(query, values);

    const updatedNote = await db.get(`SELECT * FROM notes WHERE id = ?`, [id]);
    if (updatedNote && updatedNote.tags) {
      try { updatedNote.tags = JSON.parse(updatedNote.tags); } catch (e) { updatedNote.tags = []; }
    }
    return { success: true, data: updatedNote };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

  /**
   * Get version history for a note (owner only)
   */
  async function getNoteVersions(noteId, userId) {
    try {
      if (!noteId || !userId) return { success: false, error: 'noteId and userId are required' };
      const db = await getDb();
      // Verify ownership
      const note = await db.get(`SELECT * FROM notes WHERE id = ? AND owner_id = ?`, [noteId, userId]);
      if (!note) return { success: false, error: 'Note not found or access denied' };

      const versions = await db.all(`SELECT id, note_id, title, content, updated_by, created_at FROM note_versions WHERE note_id = ? ORDER BY created_at DESC`, [noteId]);
      return { success: true, data: versions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore a version: saves current state as a version, then updates note to selected version
   */
  async function restoreVersion(noteId, versionId, userId) {
    try {
      if (!noteId || !versionId || !userId) return { success: false, error: 'noteId, versionId and userId are required' };
      const db = await getDb();
      // Verify ownership
      const note = await db.get(`SELECT * FROM notes WHERE id = ? AND owner_id = ?`, [noteId, userId]);
      if (!note) return { success: false, error: 'Note not found or access denied' };

      const version = await db.get(`SELECT * FROM note_versions WHERE id = ? AND note_id = ?`, [versionId, noteId]);
      if (!version) return { success: false, error: 'Version not found' };

      // Save current as a new version
      try {
        await db.run(`INSERT INTO note_versions (note_id, title, content, updated_by) VALUES (?, ?, ?, ?)`, [noteId, note.title, note.content, userId]);
      } catch (e) {
        console.warn('[NOTES] Could not write current snapshot to note_versions before restore:', e && e.message);
      }

      // Update note with version content
      await db.run(`UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?`, [version.title, version.content, noteId, userId]);

      const updatedNote = await db.get(`SELECT * FROM notes WHERE id = ?`, [noteId]);
      if (updatedNote && updatedNote.tags) {
        try { updatedNote.tags = JSON.parse(updatedNote.tags); } catch (e) { updatedNote.tags = []; }
      }
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
    const parsed = notes.map((n) => {
      if (n && n.tags) {
        try { n.tags = JSON.parse(n.tags); } catch (e) { n.tags = []; }
      } else {
        n.tags = [];
      }
      return n;
    });
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get notes by tag for a user
 */
async function getNotesByTag(userId, tag) {
  try {
    if (!userId || !tag) return { success: false, error: 'userId and tag are required' };
    const db = await getDb();
    // Match JSON array content containing the tag string
    const pattern = `%"${tag}"%`;
    const notes = await db.all(`SELECT * FROM notes WHERE owner_id = ? AND tags LIKE ? ORDER BY updated_at DESC`, [userId, pattern]);
    const parsed = notes.map((n) => {
      if (n && n.tags) {
        try { n.tags = JSON.parse(n.tags); } catch (e) { n.tags = []; }
      } else {
        n.tags = [];
      }
      return n;
    });
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all unique tags used by a user
 */
async function getAllTags(userId) {
  try {
    if (!userId) return { success: false, error: 'userId is required' };
    const db = await getDb();
    const notes = await db.all(`SELECT tags FROM notes WHERE owner_id = ?`, [userId]);
    const tagSet = new Set();
    notes.forEach((r) => {
      if (!r || !r.tags) return;
      try {
        const arr = JSON.parse(r.tags);
        if (Array.isArray(arr)) arr.forEach((t) => { if (t) tagSet.add(String(t).trim()); });
      } catch (e) {
        // ignore
      }
    });
    return { success: true, data: Array.from(tagSet) };
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
  getNotesByTag,
  getAllTags,
  getNoteVersions,
  restoreVersion,
};
