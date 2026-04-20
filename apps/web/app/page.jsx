'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('collabnotes_token'));
  }, []);

  if (loggedIn) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-slate-600">Open your dashboard to manage notes and collaboration.</p>
        <Link href="/dashboard" className="inline-block rounded bg-indigo-600 px-4 py-2 text-white">
          Go to Dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Collaborative notes, simplified</h1>
      <p className="text-slate-600">
        CollabNotes lets you write notes, share with teammates, and collaborate in real time.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded bg-indigo-600 px-4 py-2 text-white">
          Login
        </Link>
        <Link href="/register" className="rounded border border-slate-300 px-4 py-2">
          Register
        </Link>
      </div>
    </section>
  );
}
