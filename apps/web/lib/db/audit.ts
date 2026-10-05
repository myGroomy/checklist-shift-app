import { createHash } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './index';
import { auditLog } from '../../drizzle/schema';
import { ulid } from 'ulid';

interface AuditEntry {
  actorId: string | null;
  action: string;
  objectType?: string;
  objectId?: string;
  branchId?: string;
  shiftInstanceId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

interface HashEntry {
  seq: number;
  at: Date;
  actorId: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  branchId: string | null;
  shiftInstanceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

function computeHash(prevHash: string, entry: HashEntry): string {
  const canonical = JSON.stringify({
    seq: entry.seq,
    at: entry.at.toISOString(),
    actor_id: entry.actorId,
    action: entry.action,
    object_type: entry.objectType,
    object_id: entry.objectId,
    branch_id: entry.branchId,
    shift_instance_id: entry.shiftInstanceId,
    before: entry.before,
    after: entry.after,
    reason: entry.reason,
  });
  return createHash('sha256').update(prevHash + '|' + canonical).digest('hex');
}

/**
 * Append audit log dengan hash chain (append-only).
 * Harus dipanggil di dalam transaction yang sama dengan perubahan data.
 */
export async function appendAuditLog(tx: typeof db, entry: AuditEntry): Promise<void> {
  const lastRow = await tx
    .select({ seq: auditLog.seq, hash: auditLog.hash })
    .from(auditLog)
    .orderBy(desc(auditLog.seq))
    .limit(1);

  const prevHash = lastRow.length > 0 ? lastRow[0].hash : '0'.repeat(64);
  const seq = (lastRow.length > 0 ? lastRow[0].seq : 0) + 1;

  const fullEntry: HashEntry = {
    seq,
    at: new Date(),
    actorId: entry.actorId ?? null,
    action: entry.action,
    objectType: entry.objectType ?? null,
    objectId: entry.objectId ?? null,
    branchId: entry.branchId ?? null,
    shiftInstanceId: entry.shiftInstanceId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  };

  const hash = computeHash(prevHash, fullEntry);

  await tx.insert(auditLog).values({
    id: ulid(),
    actorId: entry.actorId,
    action: entry.action,
    objectType: entry.objectType,
    objectId: entry.objectId,
    branchId: entry.branchId,
    shiftInstanceId: entry.shiftInstanceId,
    before: entry.before as Record<string, unknown> | null,
    after: entry.after as Record<string, unknown> | null,
    reason: entry.reason,
    prevHash,
    hash,
  });
}

/**
 * Verifikasi hash chain audit log.
 * Return true jika chain valid, false jika ada mismatch.
 */
export async function verifyAuditChain(branchId?: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(branchId ? eq(auditLog.branchId, branchId) : undefined)
    .orderBy(auditLog.seq);

  if (rows.length === 0) return true;

  let expectedPrevHash = '0'.repeat(64);

  for (const row of rows) {
    const recomputed = computeHash(expectedPrevHash, {
      seq: row.seq,
      at: row.at,
      actorId: row.actorId,
      action: row.action,
      objectType: row.objectType,
      objectId: row.objectId,
      branchId: row.branchId,
      shiftInstanceId: row.shiftInstanceId,
      before: row.before as Record<string, unknown> | null,
      after: row.after as Record<string, unknown> | null,
      reason: row.reason,
    });

    if (row.prevHash !== expectedPrevHash || row.hash !== recomputed) {
      return false;
    }
    expectedPrevHash = row.hash;
  }

  return true;
}
