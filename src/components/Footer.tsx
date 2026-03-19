import { EVENT_INFO } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          {EVENT_INFO.name} {EVENT_INFO.year}
        </p>
        <p>Placeholder website structure for future registration, payments, and family account features.</p>
      </div>
    </footer>
  );
}
