import Link from 'next/link';

import { NAV_LINKS } from '@/lib/constants';

export default function Navbar() {
  return (
    <header className="bg-[#0f1e5e] shadow-lg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 shrink">
          <p className="truncate text-sm font-bold tracking-tight text-white sm:text-lg">Irvine Onnuri VBS 2026</p>
          <p className="text-xs text-blue-300">🏰 Kingdom Quest</p>
        </Link>
        <nav aria-label="Primary navigation" className="shrink-0">
          <ul className="flex items-center gap-1 sm:gap-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex rounded-full px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-white/10 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/register"
                className="inline-flex rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-orange-400 sm:px-5 sm:py-2 sm:text-sm"
              >
                Register Now
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
