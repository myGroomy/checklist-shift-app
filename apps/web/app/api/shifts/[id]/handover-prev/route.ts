import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import { handovers, shiftInstances } from '../../../../../drizzle/schema';

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const pathParts = new URL(req.url).pathname.split('/');
  const shiftInstanceId = pathParts[pathParts.length - 2];

  const [instance] = await db
    .select({
      id: shiftInstances.id,
      branchId: shiftInstances.branchId,
      openedAt: shiftInstances.openedAt,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  const [previousShift] = await db
    .select({
      id: shiftInstances.id,
      shiftDate: shiftInstances.shiftDate,
      status: shiftInstances.status,
      closedAt: shiftInstances.closedAt,
      openedAt: shiftInstances.openedAt,
    })
    .from(shiftInstances)
    .where(
      and(
        eq(shiftInstances.branchId, instance.branchId),
        inArray(shiftInstances.status, ['ditutup', 'ditutup_paksa']),
        lt(shiftInstances.openedAt, instance.openedAt)
      )
    )
    .orderBy(desc(shiftInstances.openedAt))
    .limit(1);

  const handover = previousShift
    ? await db
        .select({
          id: handovers.id,
          values: handovers.values,
          freeText: handovers.freeText,
          submittedBy: handovers.submittedBy,
          submittedAt: handovers.submittedAt,
        })
        .from(handovers)
        .where(eq(handovers.shiftInstanceId, previousShift.id))
        .limit(1)
    : [];

  return NextResponse.json({
    shift_instance_id: previousShift?.id ?? null,
    handover: handover[0] ?? null,
  });
});
