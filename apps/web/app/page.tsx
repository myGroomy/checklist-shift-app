import { redirect } from 'next/navigation';
import { ShiftDashboardClient } from '@/components/shift/shift-dashboard';
import { LandingPage } from '@/components/landing-page';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function Home() {
  const token = getSessionTokenFromCookie();
  if (!token) return <LandingPage />;

  const ctx = await validateSessionToken(token);
  if (!ctx) return <LandingPage />;

  if (ctx.user.mustChangePin) redirect('/ganti-pin');
  if (ctx.user.role === 'admin') redirect('/admin');

  return <ShiftDashboardClient userId={ctx.user.id} userName={ctx.user.name} />;
}
