import { redirect } from 'next/navigation';
import { IncidentDetail } from '@/components/incident/incident-detail';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');
  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');
  return <IncidentDetail incidentId={params.id} />;
}
