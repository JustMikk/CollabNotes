'use client';

import { apiClient } from './auth';

export const notesApi = {
  list(tag) {
    const suffix = tag ? `?tag=${encodeURIComponent(tag)}` : '';
    return apiClient.request(`/api/notes${suffix}`);
  },
  get(id) {
    return apiClient.request(`/api/notes/${id}`);
  },
  create(payload) {
    return apiClient.request('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
  },
  update(id, payload) {
    return apiClient.request(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  remove(id) {
    return apiClient.request(`/api/notes/${id}`, { method: 'DELETE' });
  },
};

export const searchApi = {
  query(q) {
    return apiClient.request(`/api/search?q=${encodeURIComponent(q)}`);
  },
};

export const sharingApi = {
  share(payload) {
    return apiClient.request('/api/shares', { method: 'POST', body: JSON.stringify(payload) });
  },
  sharedWithMe() {
    return apiClient.request('/api/shares/shared-with-me');
  },
  forNote(noteId) {
    return apiClient.request(`/api/shares/note/${noteId}`);
  },
  updatePermission(shareId, canWrite) {
    return apiClient.request(`/api/shares/${shareId}`, {
      method: 'PUT',
      body: JSON.stringify({ canWrite }),
    });
  },
  revoke(shareId) {
    return apiClient.request(`/api/shares/${shareId}`, { method: 'DELETE' });
  },
};

export const notificationsApi = {
  list() {
    return apiClient.request('/api/notifications');
  },
  markRead(id) {
    return apiClient.request(`/api/notifications/${id}/read`, { method: 'POST' });
  },
};
