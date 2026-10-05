import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/cron';

export async function GET(req: NextRequest) {
  const authErr = requireCronSecret(req);
  if (authErr) return authErr;

  return NextResponse.json({ ok: true, message: 'Cron secret valid.' });
}
