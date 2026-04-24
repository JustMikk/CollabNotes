'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { notesApi, searchApi, sharingApi } from '../../lib/api';

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return `${text.slice(0, idx)}[${text.slice(idx, idx + query.length)}]${text.slice(idx + query.length)}`;
}

export default function DashboardPage() {
  const [notes, setNotes] = useState([]);
  const [sharedNotes, setSharedNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNotes();
    loadSharedWithMe();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const result = await searchApi.query(searchTerm.trim());
        setSearchResults(result);
      } catch (err) {
        setError(err.message);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  async function loadNotes() {
    try {
      const data = await notesApi.list();
      setNotes(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSharedWithMe() {
    try {
      const response = await sharingApi.sharedWithMe();
      setSharedNotes(response.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createNote() {
    setBusy(true);
    setError('');
    try {
      await notesApi.create({
        title: newNote.title,
        content: newNote.content,
        tags: newNote.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      setNewNote({ title: '', content: '', tags: '' });
      await loadNotes();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(id) {
    await notesApi.remove(id);
    await loadNotes();
  }

  const visibleNotes = useMemo(() => (searchTerm ? searchResults : notes), [searchResults, searchTerm, notes]);

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Notes Dashboard</h1>
        <div className="flex gap-2">
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Search title/content..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <button className="rounded border px-3 py-2" onClick={() => setSearchTerm('')}>
            Clear search
          </button>
        </div>
      </header>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-xl font-semibold">Create Note</h2>
        <div className="grid gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Title"
            value={newNote.title}
            onChange={(event) => setNewNote((prev) => ({ ...prev, title: event.target.value }))}
          />
          <textarea
            className="min-h-24 rounded border px-3 py-2"
            placeholder="Content"
            value={newNote.content}
            onChange={(event) => setNewNote((prev) => ({ ...prev, content: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Tags (comma separated)"
            value={newNote.tags}
            onChange={(event) => setNewNote((prev) => ({ ...prev, tags: event.target.value }))}
          />
          <button onClick={createNote} disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-white">
            {busy ? 'Saving...' : 'Create Note'}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{searchTerm ? `Search: "${searchTerm}"` : 'My Notes'}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {visibleNotes.map((note) => (
            <article key={note.id} className="rounded border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{highlight(note.title || '', searchTerm)}</h3>
                {note.relevance ? (
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                    Relevance {note.relevance}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-600">{highlight((note.content || '').slice(0, 160), searchTerm)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(note.tags || []).map((tag) => (
                  <span key={`${note.id}-${tag}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/notes/${note.id}`} className="rounded border px-3 py-1 text-sm">
                  Edit
                </Link>
                <button className="rounded border px-3 py-1 text-sm text-red-600" onClick={() => deleteNote(note.id)}>
                  Delete
                </button>
                <Link href={`/sharing/${note.id}`} className="rounded border px-3 py-1 text-sm">
                  Share
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Shared With Me</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {sharedNotes.map((note) => (
            <article key={`shared-${note.id}`} className="rounded border bg-white p-4">
              <h3 className="font-semibold">{note.title}</h3>
              <p className="text-sm text-slate-600">{(note.content || '').slice(0, 120)}</p>
              <p className="mt-2 text-xs text-slate-500">Permission: {note.can_write ? 'write' : 'read'}</p>
              <Link href={`/notes/${note.id}`} className="mt-3 inline-block rounded border px-3 py-1 text-sm">
                Open
              </Link>
            </article>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
