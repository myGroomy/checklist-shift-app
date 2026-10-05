import { redirect } from 'next/navigation';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function Home() {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');

  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');

  if (ctx.user.mustChangePin) redirect('/ganti-pin');
  if (ctx.user.role === 'admin') redirect('/admin');

  // Beranda petugas dibangun pada Fase 4
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-bold">Halo, {ctx.user.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Beranda petugas sedang disiapkan (Fase 4).
        </p>
      </div>
    </main>
  );
}

