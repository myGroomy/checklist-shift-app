import { createHash } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../lib/db';
import { buildTemplateSnapshot, type Snapshot } from '../../../../lib/db/snapshot';
import { appendAuditLog } from '../../../../lib/db/audit';
import { getServerTime } from '../../../../lib/db/server-time';
import { getShiftDate, isWithinShiftHours } from '../../../../lib/shift/time';
import { requireBranchAccess, withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import {
  branches,
  participants,
  shiftDefinitions,
  shiftInstances,
} from '../../../../drizzle/schema';

interface OpenShiftBody {
  shiftDefinitionId?: string;
  isTest?: boolean;
}

function hashSnapshot(snapshot: Snapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

const findExisting = async (definitionId: string, shiftDate: string, isTest: boolean) => {
  const [existing] = await db
    .select({ id: shiftInstances.id })
    .from(shiftInstances)
    .where(
      and(
        eq(shiftInstances.shiftDefinitionId, definitionId),
        eq(shiftInstances.shiftDate, shiftDate),
        eq(shiftInstances.isTest, isTest),
        sql`${shiftInstances.status} <> 'void'`
      )
    )
    .limit(1);
  return existing ?? null;
};

/**
 * Buka shift (Fase 4).
 * BR-01: satu shift non-void per (definisi shift + tanggal + is_test) per cabang,
 * dijaga advisory lock + partial unique index; lock gagal = DITOLAK (fail closed).
 * BR-05: shift memakai snapshot template saat dibuka.
 * BR-02: tanggal shift = tanggal saat dibuka di zona waktu cabang.
 */
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  let body: OpenShiftBody;
  try {
    body = (await req.json()) as OpenShiftBody;
  } catch {
    body = {};
  }

  const shiftDefinitionId = body.shiftDefinitionId;
  if (!shiftDefinitionId) {
    return NextResponse.json({ error: 'shiftDefinitionId wajib diisi' }, { status: 400 });
  }
  const isTest = body.isTest === true;

  const [definition] = await db
    .select()
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.id, shiftDefinitionId))
    .limit(1);

  if (!definition) {
    return NextResponse.json({ error: 'Definisi shift tidak ditemukan' }, { status: 404 });
  }
  if (!definition.isActive) {
    return NextResponse.json({ error: 'Definisi shift tidak aktif' }, { status: 400 });
  }

  const branchAccessError = requireBranchAccess(ctx, definition.branchId);
  if (branchAccessError) return branchAccessError;

  const [branch] = await db
    .select({ id: branches.id, timezone: branches.timezone })
    .from(branches)
    .where(eq(branches.id, definition.branchId))
    .limit(1);
  if (!branch) {
    return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 });
  }

  const now = getServerTime();
  const shiftDate = getShiftDate(now, branch.timezone);
  const lockKey = `open:${definition.branchId}:${shiftDefinitionId}:${shiftDate}:${isTest ? 'test' : 'real'}`;

  // Snapshot dibangun di luar transaction (hanya baca) lalu disimpan apa adanya (BR-05).
  const snapshot = await buildTemplateSnapshot(shiftDefinitionId, branch.timezone);
  const snapshotHash = hashSnapshot(snapshot);
  const openedOutsideHours = !isWithinShiftHours(
    now,
    branch.timezone,
    definition.startTime,
    definition.endTime
  );

  try {
    const result = await db.transaction(async (tx) => {
      // BR-01: advisory lock, fail closed
      const lockResult = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) AS acquired`
      );
      const acquired = (lockResult[0] as { acquired: boolean }).acquired;
      if (!acquired) {
        return { kind: 'terkunci' as const };
      }

      const [existing] = await tx
        .select({ id: shiftInstances.id })
        .from(shiftInstances)
        .where(
          and(
            eq(shiftInstances.shiftDefinitionId, shiftDefinitionId),
            eq(shiftInstances.shiftDate, shiftDate),
            eq(shiftInstances.isTest, isTest),
            sql`${shiftInstances.status} <> 'void'`
          )
        )
        .limit(1);
      if (existing) {
        return { kind: 'bergabung' as const, shiftInstanceId: existing.id };
      }

      const shiftInstanceId = ulid();
      await tx.insert(shiftInstances).values({
        id: shiftInstanceId,
        branchId: definition.branchId,
        shiftDefinitionId,
        shiftDate,
        status: 'berjalan',
        pjUserId: ctx.user.id,
        openedBy: ctx.user.id,
        openedAt: now,
        openedOutsideHours,
        isTest,
        templateSnapshot: snapshot as unknown as Record<string, unknown>,
        snapshotHash,
      });

      // Pembuka otomatis menjadi peserta (PJ juga peserta)
      await tx.insert(participants).values({
        id: ulid(),
        shiftInstanceId,
        userId: ctx.user.id,
        firstActionAt: now,
        firstActionType: 'buka_shift',
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'open_shift',
        objectType: 'shift_instance',
        objectId: shiftInstanceId,
        branchId: definition.branchId,
        shiftInstanceId,
        after: {
          shiftDefinitionId,
          shiftDate,
          isTest,
          openedOutsideHours,
          snapshotHash,
          totalItems: snapshot.categories.reduce((sum, c) => sum + c.points.length, 0),
        },
      });

      return { kind: 'dibuka' as const, shiftInstanceId, openedOutsideHours };
    });

    if (result.kind === 'terkunci') {
      return NextResponse.json(
        { error: 'Shift sedang dibuka oleh petugas lain. Coba beberapa saat lagi.' },
        { status: 409 }
      );
    }
    if (result.kind === 'bergabung') {
      return NextResponse.json({
        status: 'bergabung',
        shift_instance_id: result.shiftInstanceId,
      });
    }
    return NextResponse.json({
      status: 'dibuka',
      shift_instance_id: result.shiftInstanceId,
      opened_outside_hours: result.openedOutsideHours,
      shift_date: shiftDate,
      total_items: snapshot.categories.reduce((sum, c) => sum + c.points.length, 0),
    });
  } catch (error) {
    // Partial unique index sebagai jaring pengaman terakhir bila race tanpa lock
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      const existing = await findExisting(shiftDefinitionId, shiftDate, isTest);
      if (existing) {
        return NextResponse.json({
          status: 'bergabung',
          shift_instance_id: existing.id,
        });
      }
    }
    console.error('Open shift error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuka shift' },
      { status: 500 }
    );
  }
});