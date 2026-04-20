'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AuthStatus() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    setToken(localStorage.getItem('collabnotes_token'));
  }, []);

  if (token) {
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Signed in</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className="rounded bg-indigo-600 px-3 py-1 text-white">
        Login
      </Link>
      <Link href="/register" className="rounded border px-3 py-1">
        Register
      </Link>
    </div>
  );
}
