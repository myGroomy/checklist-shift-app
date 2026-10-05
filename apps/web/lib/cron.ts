import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export function requireCronSecret(req: NextRequest): NextResponse | null {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET belum dikonfigurasi di environment.' },
      { status: 500 }
    );
  }

  const headerValue = req.headers.get('x-cron-secret') || req.headers.get('authorization');
  const expected = headerValue?.toLowerCase().startsWith('bearer ')
    ? headerValue.slice(7)
    : headerValue;

  if (!expected || expected !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized: CRON_SECRET tidak valid atau tidak dikirim.' },
      { status: 401 }
    );
  }

  return null;
}
