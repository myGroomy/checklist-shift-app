import { createHash } from 'crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { AlertCircle } from 'lucide-react';
import { db } from '@/lib/db';
import type { Snapshot } from '@/lib/db/snapshot';
import { PublicReportView } from '@/components/report/public-report-view';
import {
  addenda,
  branches,
  entries,
  handovers,
  incidentCategories,
  incidents,
  participants,
  reports,
  shareTokens,
  shiftInstances,
  users,
} from '@/drizzle/schema';

export default async function PublicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const rawToken = params.token;
  const hash = createHash('sha256').update(rawToken).digest('hex');

  const [share] = await db
    .select({
      id: shareTokens.id,
      reportId: shareTokens.reportId,
      shiftInstanceId: shareTokens.shiftInstanceId,
      branchId: shareTokens.branchId,
      expiresAt: shareTokens.expiresAt,
      revokedAt: shareTokens.revokedAt,
    })
    .from(shareTokens)
    .where(and(eq(shareTokens.secretHash, hash), isNull(shareTokens.revokedAt)))
    .limit(1);

  if (!share) {
    return <PublicState title="Tautan laporan tidak valid" description="Tautan ini tidak aktif, sudah dicabut, atau sudah tidak berlaku." />;
  }

  if (new Date(share.expiresAt) < new Date()) {
    return <PublicState title="Tautan laporan kedaluwarsa" description="Tautan ini sudah kedaluwarsa dan tidak dapat dibuka lagi." />;
  }

  const [report] = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      generatedAt: reports.generatedAt,
      isLocked: reports.isLocked,
      archivePdfDriveUrl: reports.archivePdfDriveUrl,
      archivedPhotoCount: reports.archivedPhotoCount,
    })
    .from(reports)
    .where(eq(reports.id, share.reportId))
    .limit(1);

  if (!report) {
    return <PublicState title="Laporan tidak ditemukan" description="Data laporan tidak ditemukan di sistem." />;
  }

  const [shift] = await db
    .select({
      id: shiftInstances.id,
      shiftDate: shiftInstances.shiftDate,
      status: shiftInstances.status,
      branchId: shiftInstances.branchId,
      openedAt: shiftInstances.openedAt,
      closedAt: shiftInstances.closedAt,
      pjUserId: shiftInstances.pjUserId,
      templateSnapshot: shiftInstances.templateSnapshot,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, share.shiftInstanceId))
    .limit(1);

  const [branch] = await db
    .select({
      id: branches.id,
      name: branches.name,
      code: branches.code,
    })
    .from(branches)
    .where(eq(branches.id, share.branchId))
    .limit(1);

  const [handover] = await db
    .select({
      id: handovers.id,
      freeText: handovers.freeText,
      values: handovers.values,
      submittedAt: handovers.submittedAt,
    })
    .from(handovers)
    .where(eq(handovers.shiftInstanceId, share.shiftInstanceId))
    .limit(1);

  if (!shift) {
    return <PublicState title="Shift tidak ditemukan" description="Data shift untuk laporan ini tidak tersedia." />;
  }

  const [pj] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, shift.pjUserId))
    .limit(1);

  const entryRows = await db
    .select({
      pointRef: entries.pointRef,
      state: entries.state,
      value: entries.value,
      skipReason: entries.skipReason,
      timingLabel: entries.timingLabel,
      completedBy: entries.completedBy,
      completedAt: entries.completedAt,
      completedByName: users.name,
    })
    .from(entries)
    .leftJoin(users, eq(entries.completedBy, users.id))
    .where(eq(entries.shiftInstanceId, share.shiftInstanceId));

  const participantRows = await db
    .select({
      id: participants.userId,
      name: users.name,
      isPj: users.id,
      firstActionAt: participants.firstActionAt,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.shiftInstanceId, share.shiftInstanceId))
    .orderBy(asc(participants.firstActionAt));

  const completedByUser = new Map<string, number>();
  for (const entry of entryRows) {
    if (entry.completedBy && entry.state === 'selesai') {
      completedByUser.set(entry.completedBy, (completedByUser.get(entry.completedBy) ?? 0) + 1);
    }
  }

  const incidentRows = await db
    .select({
      id: incidents.id,
      categoryName: incidentCategories.name,
      description: incidents.description,
      status: incidents.status,
      occurredAt: incidents.occurredAt,
    })
    .from(incidents)
    .innerJoin(incidentCategories, eq(incidents.categoryId, incidentCategories.id))
    .where(eq(incidents.shiftInstanceId, share.shiftInstanceId));

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

  return (
    <PublicReportView
      data={{
        branch: branch ? { name: branch.name, code: branch.code } : null,
        shift: {
          shiftDate: shift.shiftDate,
          status: shift.status,
          openedAt: shift.openedAt,
          closedAt: shift.closedAt,
          pjName: pj?.name ?? null,
          snapshot: shift.templateSnapshot as Snapshot,
        },
        report: {
          reportNumber: report.reportNumber,
          generatedAt: report.generatedAt,
          isLocked: report.isLocked,
          archivePdfDriveUrl: report.archivePdfDriveUrl,
          archivedPhotoCount: report.archivedPhotoCount,
        },
        entries: entryRows.map((entry) => ({
          ...entry,
          completedByName: entry.completedByName ?? null,
        })),
        participants: participantRows.map((person) => ({
          id: person.id,
          name: person.name,
          isPj: person.id === shift.pjUserId,
          itemsDone: completedByUser.get(person.id) ?? 0,
        })),
        handover: handover ?? null,
        incidents: incidentRows,
        addenda: addendumRows,
      }}
    />
  );
}

function PublicState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{description}</p>
      </div>
    </main>
  );
}
