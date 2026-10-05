import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../../lib/db';
import { requireBranchAccess, requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../../lib/auth/session';
import { reports, shareTokens, shiftInstances } from '../../../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const reportId = new URL(req.url).pathname.split('/').slice(-2)[0];
  const roleError = requireRole(ctx, 'admin');
  if (roleError) return roleError;

  let body: { expiresHours?: number } = {};
  try {
    body = (await req.json()) as { expiresHours?: number };
  } catch {
    body = {};
  }

  const expiresHours = Number(body.expiresHours ?? 168);
  const [report] = await db
    .select({
      id: reports.id,
      shiftInstanceId: reports.shiftInstanceId,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
  }

  const [shift] = await db
    .select({ id: shiftInstances.id, branchId: shiftInstances.branchId })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, report.shiftInstanceId))
    .limit(1);

  if (!shift) {
    return NextResponse.json({ error: 'Shift laporan tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, shift.branchId);
  if (branchAccessError) return branchAccessError;

  const token = randomBytes(22).toString('base64url');
  const tokenId = ulid();
  const expiresAt = new Date(Date.now() + Math.max(expiresHours, 1) * 60 * 60 * 1000);

  await db.insert(shareTokens).values({
    id: tokenId,
    secretHash: createHash('sha256').update(token).digest('hex'),
    branchId: shift.branchId,
    reportId: report.id,
    shiftInstanceId: shift.id,
    expiresAt,
    createdBy: ctx.user.id,
  });

  return NextResponse.json({
    status: 'dibuat',
    token_id: tokenId,
    token,
    expires_at: expiresAt.toISOString(),
  });
});
