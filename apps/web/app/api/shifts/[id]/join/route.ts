import { and, count, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../lib/db';
import { appendAuditLog } from '../../../../../lib/db/audit';
import { getServerTime } from '../../../../../lib/db/server-time';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import { participants, shiftInstances } from '../../../../../drizzle/schema';

/**
 * Gabung shift yang sedang berjalan (Fase 4).
 * `?duty=1` menandai aksi pertama pengguna sebagai "saya bertugas".
 */
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const pathParts = new URL(req.url).pathname.split('/');
  const shiftInstanceId = pathParts[pathParts.length - 2];
  const isDuty = new URL(req.url).searchParams.get('duty') === '1';

  const [instance] = await db
    .select({
      id: shiftInstances.id,
      branchId: shiftInstances.branchId,
      status: shiftInstances.status,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }
  if (instance.status !== 'berjalan') {
    return NextResponse.json(
      { error: 'Shift sudah ditutup. Tidak bisa bergabung.' },
      { status: 409 }
    );
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  const now = getServerTime();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: participants.id, firstActionType: participants.firstActionType })
        .from(participants)
        .where(
          and(
            eq(participants.shiftInstanceId, shiftInstanceId),
            eq(participants.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing) {
        return { joined: false, firstActionType: existing.firstActionType };
      }

      const firstActionType = isDuty ? 'saya_bertugas' : 'buka_shift';
      await tx.insert(participants).values({
        id: ulid(),
        shiftInstanceId,
        userId: ctx.user.id,
        firstActionAt: now,
        firstActionType,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: isDuty ? 'declare_duty' : 'join_shift',
        objectType: 'shift_instance',
        objectId: shiftInstanceId,
        branchId: instance.branchId,
        shiftInstanceId,
        after: { userId: ctx.user.id, firstActionType },
      });

      return { joined: true, firstActionType };
    });

    const [{ value: participantCount }] = await db
      .select({ value: count() })
      .from(participants)
      .where(eq(participants.shiftInstanceId, shiftInstanceId));

    return NextResponse.json({
      status: 'bergabung',
      shift_instance_id: shiftInstanceId,
      already_joined: !result.joined,
      first_action_type: result.firstActionType,
      participant_count: participantCount,
    });
  } catch (error) {
    // Unique index (shift_instance_id, user_id): paralel Gabung oleh user sama
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      return NextResponse.json({
        status: 'bergabung',
        shift_instance_id: shiftInstanceId,
        already_joined: true,
      });
    }
    console.error('Join shift error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat bergabung' },
      { status: 500 }
    );
  }
});