'use client';

import { SyncClient } from '@collabnotes/shared-sync/client';
import { getToken } from './auth';

const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_URL || 'ws://localhost:3002';
let client;

export function connectSync() {
  if (client) return client;
  client = new SyncClient({
    url: SYNC_URL,
    token: getToken(),
  });
  return client;
}

export function joinNote(noteId) {
  connectSync().join(noteId);
}

export function leaveNote(noteId) {
  if (!client) return;
  client.leave(noteId);
}

export function onPresence(callback) {
  return connectSync().on('presence', callback);
}

export function onCursor(callback) {
  return connectSync().on('cursor', callback);
}

export function sendCursor(noteId, position) {
  if (!client) return;
  client.sendCursor(noteId, position);
}

export function notifyNoteSaved(noteId) {
  if (!client) return;
  client.sendEdit(noteId, 0, []);
}
