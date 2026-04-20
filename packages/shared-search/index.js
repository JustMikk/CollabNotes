let notesModule;
try {
  notesModule = require('@collabnotes/shared-notes');
} catch (e) {
  notesModule = require('../shared-notes');
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function scoreMatch(query, title, content) {
  const q = normalize(query).trim();
  const t = normalize(title);
  const c = normalize(content);

  if (!q) return 0;
  if (t === q || c === q) return 100;
  if (t.includes(q)) return 75;
  if (c.includes(q)) return 50;
  return 0;
}

async function searchNotes(userId, query) {
  if (!userId || !query) {
    return { success: false, error: 'userId and query are required' };
  }

  const allNotesResult = await notesModule.getAllNotes(userId);
  if (!allNotesResult.success) {
    return allNotesResult;
  }

  const matches = allNotesResult.data
    .map((note) => ({
      ...note,
      relevance: scoreMatch(query, note.title, note.content),
    }))
    .filter((note) => note.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.id - a.id);

  return { success: true, data: matches };
}

async function searchByTag(userId, tag) {
  if (!userId || !tag) {
    return { success: false, error: 'userId and tag are required' };
  }

  return notesModule.getNotesByTag(userId, tag);
}

module.exports = {
  searchNotes,
  searchByTag,
};
