import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte, lt, desc } from 'drizzle-orm';
import { requireRole, withAuth } from '../../../../lib/auth/middleware';
import { db } from '../../../../lib/db';
import { auditLog, users, branches } from '../../../../drizzle/schema';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const { searchParams } = new URL(req.url);
  const actorId = searchParams.get('actorId');
  const action = searchParams.get('action');
  const branchId = searchParams.get('branchId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  // Cursor-based pagination: kirim seq baris terakhir pada halaman sebelumnya
  const cursorParam = searchParams.get('cursor');
  const cursor = cursorParam ? parseInt(cursorParam, 10) : null;

  const conditions = [];

  if (actorId) conditions.push(eq(auditLog.actorId, actorId));
  if (action) conditions.push(eq(auditLog.action, action));
  if (branchId) conditions.push(eq(auditLog.branchId, branchId));
  if (from) conditions.push(gte(auditLog.at, new Date(from)));
  if (to) conditions.push(lte(auditLog.at, new Date(to)));
  if (cursor !== null && !Number.isNaN(cursor)) {
    conditions.push(lt(auditLog.seq, cursor));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select({
      id: auditLog.id,
      seq: auditLog.seq,
      at: auditLog.at,
      actorId: auditLog.actorId,
      actorName: users.name,
      actorUsername: users.username,
      action: auditLog.action,
      objectType: auditLog.objectType,
      objectId: auditLog.objectId,
      branchId: auditLog.branchId,
      branchName: branches.name,
      reason: auditLog.reason,
      before: auditLog.before,
      after: auditLog.after,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .leftJoin(branches, eq(auditLog.branchId, branches.id))
    .where(whereClause)
    .orderBy(desc(auditLog.seq))
    .limit(limit);

  const nextCursor =
    logs.length === limit ? logs[logs.length - 1].seq : null;

  return NextResponse.json({ logs, nextCursor });
});
