import { asc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { requireBranchAccess, withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import {
  addenda,
  branches,
  entries,
  handovers,
  incidentCategories,
  incidents,
  participants,
  photos,
  reports,
  shiftInstances,
  users,
} from '../../../../drizzle/schema';

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
      archivePdfDriveUrl: reports.archivePdfDriveUrl,
      archivedPhotoCount: reports.archivedPhotoCount,
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
      openedAt: shiftInstances.openedAt,
      closedAt: shiftInstances.closedAt,
      templateSnapshot: shiftInstances.templateSnapshot,
      branchName: branches.name,
      branchCode: branches.code,
    })
    .from(shiftInstances)
    .innerJoin(branches, eq(shiftInstances.branchId, branches.id))
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

  const entryRows = await db
    .select({
      pointRef: entries.pointRef,
      state: entries.state,
      value: entries.value,
      skipReason: entries.skipReason,
      timingLabel: entries.timingLabel,
      completedBy: entries.completedBy,
      completedByName: users.name,
      completedAt: entries.completedAt,
    })
    .from(entries)
    .leftJoin(users, eq(entries.completedBy, users.id))
    .where(eq(entries.shiftInstanceId, shift.id));

  const participantRows = await db
    .select({
      id: participants.userId,
      name: users.name,
      firstActionAt: participants.firstActionAt,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.shiftInstanceId, shift.id))
    .orderBy(asc(participants.firstActionAt));

  const incidentRows = await db
    .select({
      id: incidents.id,
      categoryId: incidents.categoryId,
      categoryName: incidentCategories.name,
      description: incidents.description,
      occurredAt: incidents.occurredAt,
      status: incidents.status,
      severity: incidents.severity,
    })
    .from(incidents)
    .innerJoin(incidentCategories, eq(incidents.categoryId, incidentCategories.id))
    .where(eq(incidents.shiftInstanceId, shift.id));

  const addendumRows = await db
    .select({
      id: addenda.id,
      note: addenda.note,
      authorName: users.name,
      createdAt: addenda.createdAt,
    })
    .from(addenda)
    .innerJoin(users, eq(addenda.authorId, users.id))
    .where(eq(addenda.reportId, report.id))
    .orderBy(asc(addenda.createdAt));

  const [pj] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, shift.pJUserId))
    .limit(1);

  return NextResponse.json({
    report: {
      id: report.id,
      report_number: report.reportNumber,
      generated_by: report.generatedBy,
      generated_at: report.generatedAt,
      is_locked: report.isLocked,
      summary_stats: report.summaryStats,
      content_hash: report.contentHash,
      archive_pdf_drive_url: report.archivePdfDriveUrl,
      archived_photo_count: report.archivedPhotoCount,
    },
    shift: {
      id: shift.id,
      branch_id: shift.branchId,
      branch_name: shift.branchName,
      branch_code: shift.branchCode,
      shift_date: shift.shiftDate,
      status: shift.status,
      pj_user_id: shift.pJUserId,
      pj_name: pj?.name ?? null,
      opened_at: shift.openedAt,
      closed_at: shift.closedAt,
      template_snapshot: shift.templateSnapshot,
    },
    handover,
    incidents: incidentRows,
    photos: photoRows,
    entries: entryRows,
    participants: participantRows.map((participant) => ({
      ...participant,
      isPj: participant.id === shift.pJUserId,
      itemsDone: entryRows.filter((entry) => entry.completedBy === participant.id && entry.state === 'selesai').length,
    })),
    addenda: addendumRows,
  });
});
