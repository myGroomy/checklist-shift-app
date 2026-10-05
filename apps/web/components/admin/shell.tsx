'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { apiFetch } from '@/lib/admin/api';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  note?: string;
}

// 13 modul admin (APP_FLOW §6). Modul di luar Fase 3 ditandai menyusul.
const NAV: NavItem[] = [
  { href: '/admin', label: 'Dasbor', icon: LayoutDashboard, ready: true },
  { href: '/admin/cabang', label: 'Cabang', icon: Building2, ready: true },
  { href: '/admin/akun', label: 'Akun', icon: Users, ready: true },
  { href: '/admin/shift', label: 'Shift', icon: Clock, ready: true },
  { href: '/admin/checklist-builder', label: 'Checklist Builder', icon: ListChecks, ready: true },
  { href: '/admin/handover-builder', label: 'Handover Builder', icon: ClipboardList, ready: true },
  { href: '/admin/kategori-incident', label: 'Kategori Incident', icon: AlertTriangle, ready: true },
  { href: '/admin/operasi-shift', label: 'Operasi Shift', icon: Activity, ready: false, note: 'Fase 6' },
  { href: '/admin/incident', label: 'Incident', icon: FileText, ready: false, note: 'Fase 6' },
  { href: '/admin/laporan', label: 'Laporan', icon: BarChart3, ready: true },
  { href: '/admin/pengaturan', label: 'Pengaturan', icon: Settings, ready: true },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText, ready: true },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Modul admin">
      {NAV.map((item) => {
        const active = pathname === item.href;
        if (!item.ready) {
          return (
            <span
              key={item.href}
              className="flex h-11 items-center gap-3 rounded-md px-3 text-sm text-ink-light opacity-60"
              title={`Modul ${item.label} — ${item.note}`}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
              <span className="ml-auto text-[10px] uppercase">{item.note}</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
              active ? 'bg-ink text-canvas' : 'text-ink hover:bg-canvas'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; username: string };
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // sesi sudah tidak valid pun tetap diarahkan ke login
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-canvas">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <span className="text-sm font-bold">checklist-shift</span>
          <span className="ml-auto rounded-pill border border-border px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">
            Admin
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList />
        </div>
      </aside>

      {/* Topbar */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Buka menu modul">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="h-14 border-b border-border px-4 text-left">
                <SheetTitle className="text-sm font-bold">Modul Admin</SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <NavList onNavigate={() => setSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <span className="text-sm font-semibold md:hidden">Admin</span>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-10 items-center gap-2 rounded-pill border border-border px-2 text-sm hover:bg-canvas"
                  aria-label="Menu akun"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-ink text-xs font-bold text-canvas">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-40 truncate text-ink sm:inline">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-error focus:text-error"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {loggingOut ? 'Keluar...' : 'Keluar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
