import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { checkStorageHealth } from '@/lib/storage';

export async function GET() {
  const startedAt = Date.now();
  let dbStatus = 'ok';
  let storageStatus = 'ok';

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = 'error';
  }

  try {
    const storageOk = await checkStorageHealth();
    if (!storageOk) throw new Error('storage-check-failed');
  } catch {
    storageStatus = 'error';
  }

  const healthy = dbStatus === 'ok' && storageStatus === 'ok';
  const response = {
    db: dbStatus,
    storage: storageStatus,
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    latencyMs: Date.now() - startedAt,
  };

  return NextResponse.json(response, { status: healthy ? 200 : 503 });
}
