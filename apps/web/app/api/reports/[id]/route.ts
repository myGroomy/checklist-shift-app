import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { requireBranchAccess, withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import { handovers, incidents, photos, reports, shiftInstances } from '../../../../drizzle/schema';

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const reportId = new URL(req.url).pathname.split('/').at(-1) ?? '';

  const [report] = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      generatedBy: reports.generatedBy,
      generatedAt: reports.generatedAt,
      isLocked: reports.isLocked,
      summaryStats: reports.summaryStats,
      contentHash: reports.contentHash,
      shiftInstanceId: reports.shiftInstanceId,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) {
    return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
  }

  const [shift] = await db
    .select({
      id: shiftInstances.id,
      branchId: shiftInstances.branchId,
      shiftDate: shiftInstances.shiftDate,
      status: shiftInstances.status,
      pJUserId: shiftInstances.pjUserId,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, report.shiftInstanceId))
    .limit(1);

  if (!shift) {
    return NextResponse.json({ error: 'Shift laporan tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, shift.branchId);
  if (branchAccessError) return branchAccessError;

  const [handover] = await db
    .select({
      id: handovers.id,
      values: handovers.values,
      freeText: handovers.freeText,
      submittedBy: handovers.submittedBy,
      submittedAt: handovers.submittedAt,
    })
    .from(handovers)
    .where(eq(handovers.shiftInstanceId, shift.id))
    .limit(1);

  const incidentRows = await db
    .select({
      id: incidents.id,
      categoryId: incidents.categoryId,
      description: incidents.description,
      occurredAt: incidents.occurredAt,
      status: incidents.status,
      severity: incidents.severity,
    })
    .from(incidents)
    .where(eq(incidents.shiftInstanceId, shift.id));

  const photoRows = await db
    .select({
      id: photos.id,
      fileRef: photos.fileRef,
      ownerType: photos.ownerType,
      ownerId: photos.ownerId,
      mime: photos.mime,
      uploadedAt: photos.uploadedAt,
    })
    .from(photos)
    .where(eq(photos.shiftInstanceId, shift.id));

  return NextResponse.json({
    report: {
      id: report.id,
      report_number: report.reportNumber,
      generated_by: report.generatedBy,
      generated_at: report.generatedAt,
      is_locked: report.isLocked,
      summary_stats: report.summaryStats,
      content_hash: report.contentHash,
    },
    shift: {
      id: shift.id,
      branch_id: shift.branchId,
      shift_date: shift.shiftDate,
      status: shift.status,
      pj_user_id: shift.pJUserId,
    },
    handover,
    incidents: incidentRows,
    photos: photoRows,
  });
});
