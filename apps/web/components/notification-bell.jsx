'use client';

import { useEffect, useState } from 'react';
import { notificationsApi } from '../lib/api';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const response = await notificationsApi.list();
      setItems(response.data || []);
    } catch (err) {
      setItems([]);
    }
  }

  async function markRead(id) {
    await notificationsApi.markRead(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="relative">
      <button className="relative rounded border px-2 py-1 text-sm" onClick={() => setOpen((prev) => !prev)}>
        Bell
        {unread > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded border bg-white p-2 shadow">
          <p className="mb-2 text-xs font-semibold text-slate-500">Notifications</p>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className={`w-full rounded px-2 py-1 text-left text-sm ${item.read ? 'text-slate-500' : 'bg-slate-100'}`}
                  onClick={() => markRead(item.id)}
                >
                  {item.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
