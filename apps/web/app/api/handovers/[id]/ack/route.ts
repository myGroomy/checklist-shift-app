import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../lib/db';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import { handoverAcks, handovers, shiftInstances } from '../../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const handoverId = new URL(req.url).pathname.split('/').slice(-2)[0];
  let body: { shift_instance_id?: string } = {};
  try {
    body = (await req.json()) as { shift_instance_id?: string };
  } catch {}

  const [handover] = await db
    .select({
      id: handovers.id,
      shiftInstanceId: handovers.shiftInstanceId,
    })
    .from(handovers)
    .where(eq(handovers.id, handoverId))
    .limit(1);

  if (!handover) {
    return NextResponse.json({ error: 'Handover tidak ditemukan' }, { status: 404 });
  }

  const [instance] = await db
    .select({ id: shiftInstances.id, branchId: shiftInstances.branchId })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, handover.shiftInstanceId))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ error: 'Shift handover tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  const readingShiftInstanceId = body.shift_instance_id ?? handover.shiftInstanceId;

  try {
    const [existing] = await db
      .select({ id: handoverAcks.id })
      .from(handoverAcks)
      .where(
        and(
          eq(handoverAcks.handoverId, handoverId),
          eq(handoverAcks.readingShiftInstanceId, readingShiftInstanceId),
          eq(handoverAcks.userId, ctx.user.id)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ status: 'sudah_dibaca', handover_id: handoverId });
    }

    await db.insert(handoverAcks).values({
      id: ulid(),
      handoverId,
      readingShiftInstanceId,
      userId: ctx.user.id,
      readAt: new Date(),
    });

    return NextResponse.json({ status: 'dibaca', handover_id: handoverId });
  } catch (error) {
    console.error('Ack handover error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan tanda sudah dibaca' },
      { status: 500 }
    );
  }
});
