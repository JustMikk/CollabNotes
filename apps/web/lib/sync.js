'use client';

import { io } from 'socket.io-client';
import { getToken } from './auth';

const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_URL || 'ws://localhost:3002';
let socket;

export function connectSync() {
  if (socket) return socket;
  socket = io(SYNC_URL, {
    transports: ['websocket'],
    auth: {
      token: getToken(),
    },
  });
  return socket;
}

export function joinNote(noteId) {
  const client = connectSync();
  client.emit('note:join', { noteId });
}

export function leaveNote(noteId) {
  if (!socket) return;
  socket.emit('note:leave', { noteId });
}

export function onPresence(callback) {
  const client = connectSync();
  client.on('presence:update', callback);
  return () => client.off('presence:update', callback);
}

export function onCursor(callback) {
  const client = connectSync();
  client.on('cursor:update', callback);
  return () => client.off('cursor:update', callback);
}

export function sendCursor(noteId, position) {
  if (!socket) return;
  socket.emit('cursor:update', { noteId, position });
}

export function notifyNoteSaved(noteId) {
  if (!socket) return;
  socket.emit('note:saved', { noteId });
}
