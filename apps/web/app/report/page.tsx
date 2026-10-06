import { redirect } from 'next/navigation';
import { ReportList } from '@/components/report/report-list';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function ReportPage() {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');
  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');
  return <ReportList />;
}
