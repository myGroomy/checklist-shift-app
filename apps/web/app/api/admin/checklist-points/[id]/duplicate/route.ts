import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import {
  checklistPoints,
  sopCategories,
  shiftDefinitions,
} from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/checklist-points/[id]/duplicate -> pointId is at length - 2
  const pointId = pathParts[pathParts.length - 2];

  const [sourcePoint] = await db
    .select({
      point: checklistPoints,
      branchId: shiftDefinitions.branchId,
    })
    .from(checklistPoints)
    .innerJoin(sopCategories, eq(checklistPoints.sopCategoryId, sopCategories.id))
    .innerJoin(shiftDefinitions, eq(sopCategories.shiftDefinitionId, shiftDefinitions.id))
    .where(eq(checklistPoints.id, pointId))
    .limit(1);

  if (!sourcePoint) {
    return NextResponse.json({ error: 'Checklist point tidak ditemukan' }, { status: 404 });
  }

  const newPointId = ulid();
  const pt = sourcePoint.point;

  await db.transaction(async (tx) => {
    await tx.insert(checklistPoints).values({
      id: newPointId,
      sopCategoryId: pt.sopCategoryId,
      title: `${pt.title} (Salinan)`,
      instruction: pt.instruction,
      inputType: pt.inputType,
      isRequired: pt.isRequired,
      targetTime: pt.targetTime,
      toleranceMinutes: pt.toleranceMinutes,
      activeDays: pt.activeDays,
      numberMin: pt.numberMin,
      numberMax: pt.numberMax,
      sortOrder: pt.sortOrder + 1,
      isActive: true,
    });

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'duplicate_checklist_point',
      objectType: 'checklist_point',
      objectId: newPointId,
      branchId: sourcePoint.branchId,
      after: { originalPointId: pointId, newPointId },
    });
  });

  return NextResponse.json({
    message: 'Checklist point berhasil diduplikasi',
    newPointId,
  });
});
