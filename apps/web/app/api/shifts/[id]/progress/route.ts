import { asc, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import type { Snapshot } from '../../../../../lib/db/snapshot';
import { getServerTime } from '../../../../../lib/db/server-time';
import { getZonedParts, isPointActiveOn } from '../../../../../lib/shift/time';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import {
  branches,
  entries,
  participants,
  shiftInstances,
  users,
} from '../../../../../drizzle/schema';

interface ProgressEntry {
  point_ref: string;
  title: string;
  instruction: string | null;
  input_type: string;
  is_required: boolean;
  target_time: string | null;
  number_min: number | null;
  number_max: number | null;
  sort_order: number;
  state: 'belum' | 'selesai' | 'skip';
  value: string | null;
  out_of_range: boolean;
  skip_reason: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  timing_label: string | null;
  timing_delta_minutes: number | null;
}

type EntryRow = typeof entries.$inferSelect;

interface ProgressCategory {
  id: string;
  name: string;
  sort_order: number;
  points: ProgressEntry[];
}

/**
 * Progress shift untuk polling (Fase 4): seluruh item yang berlaku hari ini
 * beserta state, dan daftar peserta. Item difilter berdasarkan active_days
 * memakai tanggal shift di zona waktu cabang.
 */
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const pathParts = new URL(req.url).pathname.split('/');
  const shiftInstanceId = pathParts[pathParts.length - 2];

  const [instance] = await db
    .select()
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId))
    .limit(1);
  if (!instance) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  const [branch] = await db
    .select({ timezone: branches.timezone })
    .from(branches)
    .where(eq(branches.id, instance.branchId))
    .limit(1);

  const snapshot = instance.templateSnapshot as unknown as Snapshot;
  const now = getServerTime();
  const dayKey = getZonedParts(now, branch?.timezone ?? 'Asia/Jakarta').dayKey;

  const entryRows = await db
    .select()
    .from(entries)
    .where(eq(entries.shiftInstanceId, shiftInstanceId));
  const entryByRef = new Map<string, EntryRow>(entryRows.map((e) => [e.pointRef, e]));

  const completerIds = [
    ...new Set(entryRows.map((e) => e.completedBy).filter((v): v is string => !!v)),
  ];
  const nameById = new Map<string, string>();
  if (completerIds.length > 0) {
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, completerIds));
    for (const u of userRows) nameById.set(u.id, u.name);
  }

  const categories: ProgressCategory[] = snapshot.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sort_order: cat.sort_order,
    points: cat.points
      .filter((p) => isPointActiveOn(p.active_days, dayKey))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map<ProgressEntry>((p) => {
        const entry = entryByRef.get(p.point_ref);
        return {
          point_ref: p.point_ref,
          title: p.title,
          instruction: p.instruction,
          input_type: p.input_type,
          is_required: p.is_required,
          target_time: p.target_time,
          number_min: p.number_min,
          number_max: p.number_max,
          sort_order: p.sort_order,
          state: entry?.state ?? 'belum',
          value: entry?.value ?? null,
          out_of_range: entry?.outOfRange ?? false,
          skip_reason: entry?.skipReason ?? null,
          completed_by: entry?.completedBy ?? null,
          completed_by_name: entry?.completedBy ? (nameById.get(entry.completedBy) ?? null) : null,
          completed_at: entry?.completedAt?.toISOString() ?? null,
          timing_label: entry?.timingLabel ?? null,
          timing_delta_minutes: entry?.timingDeltaMinutes ?? null,
        };
      }),
  }));

  const allPoints = categories.flatMap((c) => c.points);
  const done = allPoints.filter((p) => p.state === 'selesai').length;
  const skipped = allPoints.filter((p) => p.state === 'skip').length;

  const participantRows = await db
    .select({
      userId: participants.userId,
      name: users.name,
      firstActionAt: participants.firstActionAt,
      firstActionType: participants.firstActionType,
    })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(eq(participants.shiftInstanceId, shiftInstanceId))
    .orderBy(asc(participants.firstActionAt));

  const perUser = new Map<string, number>();
  for (const row of entryRows) {
    if (!row.completedBy) continue;
    perUser.set(row.completedBy, (perUser.get(row.completedBy) ?? 0) + 1);
  }

  return NextResponse.json({
    shift: {
      id: instance.id,
      branch_id: instance.branchId,
      branch_timezone: branch?.timezone ?? null,
      shift_definition_id: instance.shiftDefinitionId,
      name: snapshot.shift.name,
      start_time: snapshot.shift.start_time,
      end_time: snapshot.shift.end_time,
      date: instance.shiftDate,
      status: instance.status,
      pj_user_id: instance.pjUserId,
      opened_outside_hours: instance.openedOutsideHours,
      is_test: instance.isTest,
    },
    progress: {
      total: allPoints.length,
      selesai: done,
      skip: skipped,
      belum: allPoints.length - done - skipped,
      wajib_selesai: allPoints.filter((p) => p.is_required && p.state === 'selesai').length,
    },
    categories,
    participants: participantRows.map((p) => ({
      user_id: p.userId,
      name: p.name,
      is_pj: p.userId === instance.pjUserId,
      first_action_type: p.firstActionType,
      first_action_at: p.firstActionAt.toISOString(),
      items_done: perUser.get(p.userId) ?? 0,
    })),
    handover_fields: snapshot.handover_fields,
    server_time: now.toISOString(),
  });
});