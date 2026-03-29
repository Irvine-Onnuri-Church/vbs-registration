import Link from 'next/link';

import { NAV_LINKS } from '@/lib/constants';

export default function Navbar() {
  return (
    <header className="bg-[#0f1e5e] shadow-lg">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Irvine Onnuri VBS 2026
          </Link>
          <p className="text-sm text-blue-300">🏰 Kingdom Quest</p>
        </div>
        <nav aria-label="Primary navigation">
          <ul className="flex flex-wrap items-center gap-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex rounded-full px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/register"
                className="inline-flex rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-orange-400"
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
