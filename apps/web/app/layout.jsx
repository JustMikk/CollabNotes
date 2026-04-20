import './globals.css';
import Link from 'next/link';
import AuthStatus from '../components/auth-status';
import NotificationBell from '../components/notification-bell';
import Providers from '../components/providers';

export const metadata = {
  title: 'CollabNotes',
  description: 'Collaborative note-taking platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <nav className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-indigo-600">
              CollabNotes
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="hover:text-indigo-600">
                Dashboard
              </Link>
              <NotificationBell />
              <AuthStatus />
            </div>
          </div>
        </nav>
        <Providers>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
