/**
 * Export utilities for notes
 */

function sanitizeFilenamePart(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\-\_ ]+/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

function exportToJSON(note) {
  return JSON.stringify(note, null, 2);
}

function exportToMarkdown(note) {
  const title = note.title || '';
  const content = note.content || '';
  const tags = Array.isArray(note.tags) ? note.tags.join(', ') : (note.tags || '');
  const meta = [];
  meta.push(`- id: ${note.id}`);
  if (note.owner_id) meta.push(`- owner_id: ${note.owner_id}`);
  if (note.created_at) meta.push(`- created_at: ${note.created_at}`);
  if (note.updated_at) meta.push(`- updated_at: ${note.updated_at}`);
  if (tags) meta.push(`- tags: ${tags}`);

  return `# ${title}\n\n${meta.join('\n')}\n\n---\n\n${content}`;
}

function exportToText(note) {
  const title = note.title || '';
  const content = note.content || '';
  const tags = Array.isArray(note.tags) ? note.tags.join(', ') : (note.tags || '');
  const lines = [];
  lines.push(`Title: ${title}`);
  if (note.id) lines.push(`ID: ${note.id}`);
  if (note.owner_id) lines.push(`Owner: ${note.owner_id}`);
  if (note.created_at) lines.push(`Created: ${note.created_at}`);
  if (note.updated_at) lines.push(`Updated: ${note.updated_at}`);
  if (tags) lines.push(`Tags: ${tags}`);
  lines.push('\n');
  lines.push(content);
  return lines.join('\n');
}

function filenameFor(note, format) {
  const ext = format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json';
  const name = sanitizeFilenamePart(note.title || `note-${note.id || 'unknown'}`) || `note-${note.id || 'unknown'}`;
  return `note-${note.id || '0'}-${name}.${ext}`;
}

module.exports = {
  exportToJSON,
  exportToMarkdown,
  exportToText,
  filenameFor,
};
