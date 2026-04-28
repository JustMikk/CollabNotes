'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { sharingApi } from '../../../lib/api';

export default function ShareManagementPage() {
  const { id } = useParams();
  const [shares, setShares] = useState([]);
  const [form, setForm] = useState({ userId: '', canWrite: false });

  useEffect(() => {
    loadShares();
  }, [id]);

  async function loadShares() {
    const result = await sharingApi.forNote(id);
    setShares(result.data || []);
  }

  async function addShare() {
    await sharingApi.share({
      noteId: Number(id),
      userId: Number(form.userId),
      canWrite: !!form.canWrite,
    });
    setForm({ userId: '', canWrite: false });
    await loadShares();
  }

  async function updatePermission(shareId, canWrite) {
    await sharingApi.updatePermission(shareId, !canWrite);
    await loadShares();
  }

  async function revoke(shareId) {
    await sharingApi.revoke(shareId);
    await loadShares();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Sharing Management</h1>
      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Share note</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="User ID"
            value={form.userId}
            onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={form.canWrite}
              onChange={(event) => setForm((prev) => ({ ...prev, canWrite: event.target.checked }))}
            />
            Write permission
          </label>
          <button className="rounded bg-indigo-600 px-3 py-2 text-white" onClick={addShare}>
            Share
          </button>
        </div>
      </div>
      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">Users with access</h2>
        <ul className="space-y-2">
          {shares.map((share) => (
            <li key={share.id} className="flex items-center justify-between rounded bg-slate-50 p-2">
              <span>User #{share.shared_with_id}</span>
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 text-sm" onClick={() => updatePermission(share.id, share.can_write)}>
                  {share.can_write ? 'Set read-only' : 'Set write'}
                </button>
                <button className="rounded border px-2 py-1 text-sm text-red-600" onClick={() => revoke(share.id)}>
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
