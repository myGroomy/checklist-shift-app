import { eq } from 'drizzle-orm';
import { db } from './index';
import { entryLogs } from '../../drizzle/schema';

/**
 * Cek idempotency berdasarkan client_action_id.
 * Return true jika sudah pernah diproses (duplikat).
 */
export async function checkIdempotency(clientActionId: string): Promise<boolean> {
  const existing = await db
    .select({ id: entryLogs.id })
    .from(entryLogs)
    .where(eq(entryLogs.clientActionId, clientActionId))
    .limit(1);
  return existing.length > 0;
}
