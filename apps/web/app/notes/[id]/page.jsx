'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { notesApi, sharingApi } from '../../../lib/api';
import { joinNote, leaveNote, notifyNoteSaved, onCursor, onPresence, sendCursor } from '../../../lib/sync';
import toast from 'react-hot-toast';

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id;

  const [note, setNote] = useState(null);
  const [shares, setShares] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    load();
  }, [noteId]);

  useEffect(() => {
    if (!noteId) return;
    joinNote(noteId);
    const offPresence = onPresence((payload) => {
      if (String(payload.noteId) !== String(noteId)) return;
      setActiveUsers(payload.users || []);
      if (payload.users?.length > 1) {
        toast('Someone is editing this note');
      }
    });
    const offCursor = onCursor((payload) => {
      if (String(payload.noteId) !== String(noteId)) return;
      if (payload.username) {
        toast(`${payload.username} moved cursor`);
      }
    });

    return () => {
      offPresence();
      offCursor();
      leaveNote(noteId);
    };
  }, [noteId]);

  async function load() {
    try {
      const [noteData, sharesData] = await Promise.all([notesApi.get(noteId), sharingApi.forNote(noteId)]);
      setNote({ ...noteData, tags: Array.isArray(noteData.tags) ? noteData.tags.join(', ') : '' });
      setShares(sharesData.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveNote() {
    setSaving(true);
    setError('');
    try {
      await notesApi.update(noteId, {
        title: note.title,
        content: note.content,
        tags: note.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      notifyNoteSaved(noteId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    await notesApi.remove(noteId);
    router.push('/dashboard');
  }

  if (!note) return <p>Loading note...</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Edit Note</h1>
      <div className="rounded border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Active users:</span>
          {activeUsers.length === 0 ? <span className="text-sm text-slate-400">None</span> : null}
          {activeUsers.map((user) => (
            <span key={user.id} className="rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
              {user.username}
            </span>
          ))}
        </div>
        <input
          className="mb-2 w-full rounded border px-3 py-2"
          value={note.title || ''}
          onChange={(event) => setNote((prev) => ({ ...prev, title: event.target.value }))}
        />
        <textarea
          className="mb-2 min-h-44 w-full rounded border px-3 py-2"
          value={note.content || ''}
          onChange={(event) => {
            setNote((prev) => ({ ...prev, content: event.target.value }));
            sendCursor(noteId, event.target.selectionStart || 0);
          }}
        />
        <input
          className="mb-3 w-full rounded border px-3 py-2"
          value={note.tags}
          onChange={(event) => setNote((prev) => ({ ...prev, tags: event.target.value }))}
          placeholder="Tags (comma separated)"
        />
        <div className="flex gap-2">
          <button className="rounded bg-indigo-600 px-4 py-2 text-white" onClick={saveNote} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="rounded border px-4 py-2 text-red-600" onClick={deleteNote}>
            Delete
          </button>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Sharing info</h2>
        <ul className="space-y-2 text-sm">
          {shares.map((share) => (
            <li key={share.id} className="flex justify-between rounded bg-slate-50 px-3 py-2">
              <span>User #{share.shared_with_id}</span>
              <span>{share.can_write ? 'write' : 'read'}</span>
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
