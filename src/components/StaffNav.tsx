'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/mostrador', label: 'Mostrador' },
  { href: '/pantalla', label: 'Pantalla de sala' },
  { href: '/', label: 'Tótem' },
  { href: '/configurar', label: 'Configurar' },
];

export function StaffNav({ businessName, onLogout }: { businessName?: string; onLogout: () => void }) {
  const path = usePathname();
  return (
    <header className="flex flex-wrap items-center gap-3 bg-ink px-5 py-3 text-white">
      <span className="flex items-center gap-2 text-lg font-extrabold">
        <span className="rounded-lg bg-brand px-2">T</span>
        {businessName || 'Turnero'}
      </span>
      <nav className="ml-auto flex flex-wrap gap-1 rounded-xl bg-slate-800 p-1 text-sm">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 font-medium ${path === l.href ? 'bg-white text-ink' : 'text-slate-300 hover:text-white'}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <button onClick={onLogout} className="text-sm text-slate-400 hover:text-white">
        Salir
      </button>
    </header>
  );
}
