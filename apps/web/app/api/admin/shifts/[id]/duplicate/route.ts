import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import {
  shiftDefinitions,
  sopCategories,
  checklistPoints,
  handoverFields,
} from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/shifts/[id]/duplicate -> shiftId is at length - 2
  const shiftId = pathParts[pathParts.length - 2];

  const [sourceShift] = await db
    .select()
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.id, shiftId))
    .limit(1);

  if (!sourceShift) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  const newShiftId = ulid();

  await db.transaction(async (tx) => {
    await tx.insert(shiftDefinitions).values({
      id: newShiftId,
      branchId: sourceShift.branchId,
      name: `${sourceShift.name} (Salinan)`,
      startTime: sourceShift.startTime,
      endTime: sourceShift.endTime,
      crossesMidnight: sourceShift.crossesMidnight,
      sortOrder: sourceShift.sortOrder + 1,
      isActive: true,
    });

    // Copy handover fields
    const sourceHandovers = await tx
      .select()
      .from(handoverFields)
      .where(eq(handoverFields.shiftDefinitionId, shiftId));

    for (const ho of sourceHandovers) {
      await tx.insert(handoverFields).values({
        id: ulid(),
        shiftDefinitionId: newShiftId,
        label: ho.label,
        fieldType: ho.fieldType,
        options: ho.options,
        isRequired: ho.isRequired,
        sortOrder: ho.sortOrder,
        isActive: ho.isActive,
      });
    }

    // Copy SOP categories & points
    const sourceCats = await tx
      .select()
      .from(sopCategories)
      .where(eq(sopCategories.shiftDefinitionId, shiftId));

    for (const cat of sourceCats) {
      const newCatId = ulid();
      await tx.insert(sopCategories).values({
        id: newCatId,
        shiftDefinitionId: newShiftId,
        name: cat.name,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      });

      const sourcePoints = await tx
        .select()
        .from(checklistPoints)
        .where(eq(checklistPoints.sopCategoryId, cat.id));

      for (const pt of sourcePoints) {
        await tx.insert(checklistPoints).values({
          id: ulid(),
          sopCategoryId: newCatId,
          title: pt.title,
          instruction: pt.instruction,
          inputType: pt.inputType,
          isRequired: pt.isRequired,
          targetTime: pt.targetTime,
          toleranceMinutes: pt.toleranceMinutes,
          activeDays: pt.activeDays,
          numberMin: pt.numberMin,
          numberMax: pt.numberMax,
          sortOrder: pt.sortOrder,
          isActive: pt.isActive,
        });
      }
    }

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'duplicate_shift_definition',
      objectType: 'shift_definition',
      objectId: newShiftId,
      branchId: sourceShift.branchId,
      after: { originalShiftId: shiftId, newShiftId },
    });
  });

  return NextResponse.json({
    message: 'Definisi shift berhasil diduplikasi',
    newShiftId,
  });
});
