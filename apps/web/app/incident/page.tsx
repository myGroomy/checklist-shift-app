import { redirect } from 'next/navigation';
import { IncidentList } from '@/components/incident/incident-list';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function IncidentPage() {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');
  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');
  if (ctx.user.mustChangePin) redirect('/ganti-pin');

  return <IncidentList />;
}
