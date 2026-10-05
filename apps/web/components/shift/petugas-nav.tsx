'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ClipboardCheck, FileText, Home } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/#daftar-shift', label: 'Checklist', icon: ClipboardCheck },
  { href: '/incident', label: 'Incident', icon: AlertTriangle },
  { href: '/report', label: 'Laporan', icon: FileText },
];

export function PetugasNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi petugas"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {LINKS.map((link) => {
          const active = link.href === '/'
            ? pathname === '/'
            : link.href === '/#daftar-shift'
            ? pathname.startsWith('/shift')
              : pathname.startsWith('/incident');
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-ink' : 'text-ink-muted'
              }`}
            >
              <link.icon className="h-5 w-5" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
