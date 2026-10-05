import { redirect } from 'next/navigation';
import { ReportDetail } from '@/components/report/report-detail';
import { getSessionTokenFromCookie, validateSessionToken } from '@/lib/auth/session';

export default async function ReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');
  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');
  if (ctx.user.mustChangePin) redirect('/ganti-pin');

  return <ReportDetail reportId={params.id} />;
}
