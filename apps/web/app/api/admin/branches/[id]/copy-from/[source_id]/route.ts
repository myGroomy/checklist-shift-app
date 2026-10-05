import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { requireRole, withAuth } from '../../../../../../../lib/auth/middleware';
import { db } from '../../../../../../../lib/db';
import {
  branches,
  shiftDefinitions,
  sopCategories,
  checklistPoints,
  handoverFields,
} from '../../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/branches/[id]/copy-from/[source_id]
  // pathParts: [..., 'branches', targetBranchId, 'copy-from', sourceBranchId]
  const sourceBranchId = pathParts[pathParts.length - 1];
  const targetBranchId = pathParts[pathParts.length - 3];

  if (targetBranchId === sourceBranchId) {
    return NextResponse.json(
      { error: 'Cabang sumber dan cabang tujuan tidak boleh sama' },
      { status: 400 }
    );
  }

  // Verifikasi cabang target & sumber
  const [targetBranch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, targetBranchId))
    .limit(1);

  const [sourceBranch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, sourceBranchId))
    .limit(1);

  if (!targetBranch || !sourceBranch) {
    return NextResponse.json(
      { error: 'Cabang sumber atau cabang tujuan tidak ditemukan' },
      { status: 404 }
    );
  }

  // Ambil semua data template dari cabang sumber
  const sourceShifts = await db
    .select()
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.branchId, sourceBranchId));

  await db.transaction(async (tx) => {
    let copiedShiftsCount = 0;
    let copiedPointsCount = 0;

    for (const sourceShift of sourceShifts) {
      const newShiftId = ulid();

      await tx.insert(shiftDefinitions).values({
        id: newShiftId,
        branchId: targetBranchId,
        name: sourceShift.name,
        startTime: sourceShift.startTime,
        endTime: sourceShift.endTime,
        crossesMidnight: sourceShift.crossesMidnight,
        sortOrder: sourceShift.sortOrder,
        isActive: sourceShift.isActive,
      });
      copiedShiftsCount++;

      // Copy handover fields
      const sourceHandovers = await tx
        .select()
        .from(handoverFields)
        .where(eq(handoverFields.shiftDefinitionId, sourceShift.id));

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

      // Copy SOP categories & checklist points
      const sourceCats = await tx
        .select()
        .from(sopCategories)
        .where(eq(sopCategories.shiftDefinitionId, sourceShift.id));

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
          copiedPointsCount++;
        }
      }
    }

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'copy_template_from_branch',
      objectType: 'branch',
      objectId: targetBranchId,
      branchId: targetBranchId,
      after: {
        sourceBranchId,
        copiedShiftsCount,
        copiedPointsCount,
      },
    });
  });

  return NextResponse.json({
    message: `Berhasil menyalin template dari cabang ${sourceBranch.name}`,
  });
});
