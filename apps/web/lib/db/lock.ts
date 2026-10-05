import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * Ambil advisory lock PostgreSQL (fail closed).
 * Return true jika lock berhasil diambil, false jika gagal.
 * Lock dilepas otomatis saat transaction selesai.
 */
export async function acquireAdvisoryLock(key: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS acquired`
  );
  return (result[0] as { acquired: boolean }).acquired;
}
