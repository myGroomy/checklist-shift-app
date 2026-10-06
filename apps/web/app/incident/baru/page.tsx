import { redirect } from 'next/navigation';
import { IncidentCreateForm } from '@/components/incident/incident-create-form';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function CreateIncidentPage() {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');
  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');
  return <IncidentCreateForm />;
}
