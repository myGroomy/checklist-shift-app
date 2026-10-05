import { redirect } from 'next/navigation';
import { ShiftChecklistClient } from '@/components/shift/shift-checklist';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function ShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');

  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');
  if (ctx.user.mustChangePin) redirect('/ganti-pin');

  return <ShiftChecklistClient shiftId={id} />;
}
