import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../../lib/db';
import { requireBranchAccess, requireRole, withAuth } from '../../../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../../../lib/auth/session';
import { reports, shareTokens, shiftInstances } from '../../../../../../../drizzle/schema';

export const DELETE = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const pathParts = new URL(req.url).pathname.split('/');
  const reportId = pathParts[pathParts.length - 3];
  const tokenId = pathParts[pathParts.length - 1];

  const roleError = requireRole(ctx, 'admin');
  if (roleError) return roleError;

  const [token] = await db
    .select({
      id: shareTokens.id,
      reportId: shareTokens.reportId,
      branchId: shareTokens.branchId,
    })
    .from(shareTokens)
    .where(and(eq(shareTokens.id, tokenId), eq(shareTokens.reportId, reportId)))
    .limit(1);

  if (!token) {
    return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 404 });
  }

  const [report] = await db
    .select({ id: reports.id, shiftInstanceId: reports.shiftInstanceId })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
  }

  const [shift] = await db
    .select({ branchId: shiftInstances.branchId })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, report.shiftInstanceId))
    .limit(1);

  if (!shift) {
    return NextResponse.json({ error: 'Shift laporan tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, shift.branchId);
  if (branchAccessError) return branchAccessError;

  await db
    .update(shareTokens)
    .set({ revokedAt: new Date(), revokedBy: ctx.user.id })
    .where(eq(shareTokens.id, token.id));

  return NextResponse.json({ status: 'dicabut', token_id: token.id });
});
