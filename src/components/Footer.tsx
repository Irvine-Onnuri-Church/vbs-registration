import { EVENT_INFO } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-[#080f2e] py-6 text-center text-sm text-blue-400">
      <p className="font-semibold text-white">
        {EVENT_INFO.name} — {EVENT_INFO.subtitle}
      </p>
      <p className="mt-1">{EVENT_INFO.church} · {EVENT_INFO.address}</p>
      <p className="mt-1 text-blue-500">© 2026 {EVENT_INFO.church}</p>
    </footer>
  );
}
