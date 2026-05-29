'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { EVENT_INFO } from '@/lib/constants';

export default function Navbar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();

    function checkAdmin() {
      fetch('/api/admin/auth')
        .then((res) => setIsAdmin(res.ok))
        .catch(() => setIsAdmin(false));
    }

    window.addEventListener('admin-auth-changed', checkAdmin);
    return () => window.removeEventListener('admin-auth-changed', checkAdmin);
  }, [pathname]);

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setIsAdmin(false);
    window.location.href = '/';
  }

  const adminLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/checkin', label: 'Check-in' },
  ];

  const publicLinks = [
    { href: '/', label: 'Home' },
    { href: '/mypage', label: 'My Registration' },
  ];

  const links = isAdmin ? adminLinks : publicLinks;

  return (
    <header className="bg-[#0f1e5e] shadow-lg">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 shrink">
          <p className="truncate text-sm font-bold tracking-tight text-white sm:text-lg">{EVENT_INFO.name}</p>
          <p className="text-xs text-blue-300">🏰 {EVENT_INFO.subtitle}</p>
        </Link>
        <nav aria-label="Primary navigation" className="shrink-0">
          <ul className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-white/10 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAdmin ? (
              <li>
                <button
                  onClick={handleLogout}
                  className="inline-flex rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-400 sm:px-5 sm:py-2 sm:text-sm"
                >
                  Log Out
                </button>
              </li>
            ) : (
              <li>
                <Link
                  href="/register"
                  className="inline-flex rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-400 sm:px-5 sm:py-2 sm:text-sm"
                >
                  Register
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
