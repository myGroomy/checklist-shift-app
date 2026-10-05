import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../../lib/db';
import { appendAuditLog } from '../../../../../../lib/db/audit';
import { requireBranchAccess, requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../../lib/auth/session';
import { addenda, reports, shiftInstances } from '../../../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const reportId = new URL(req.url).pathname.split('/').slice(-2)[0];
  const roleError = requireRole(ctx, 'admin');
  if (roleError) return roleError;

  let body: { note?: string } = {};
  try {
    body = (await req.json()) as { note?: string };
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 });
  }

  const note = body.note?.trim();
  if (!note) {
    return NextResponse.json({ error: 'note wajib diisi' }, { status: 400 });
  }

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
    .select({ branchId: shiftInstances.branchId })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, report.shiftInstanceId))
    .limit(1);

  if (!shift) {
    return NextResponse.json({ error: 'Shift laporan tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, shift.branchId);
  if (branchAccessError) return branchAccessError;

  const id = ulid();

  await db.transaction(async (tx) => {
    await tx.insert(addenda).values({
      id,
      reportId: report.id,
      authorId: ctx.user.id,
      note,
    });

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'addendum_report',
      objectType: 'report',
      objectId: report.id,
      branchId: shift.branchId,
      shiftInstanceId: report.shiftInstanceId ?? undefined,
      after: { note },
    });
  });

  return NextResponse.json({ status: 'dibuat', addendum_id: id });
});
