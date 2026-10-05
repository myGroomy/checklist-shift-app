import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import {
  sopCategories,
  checklistPoints,
  shiftDefinitions,
} from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/sop-categories/[id]/duplicate -> categoryId is at length - 2
  const categoryId = pathParts[pathParts.length - 2];

  const [sourceCat] = await db
    .select({
      id: sopCategories.id,
      shiftDefinitionId: sopCategories.shiftDefinitionId,
      name: sopCategories.name,
      sortOrder: sopCategories.sortOrder,
      isActive: sopCategories.isActive,
      branchId: shiftDefinitions.branchId,
    })
    .from(sopCategories)
    .innerJoin(shiftDefinitions, eq(sopCategories.shiftDefinitionId, shiftDefinitions.id))
    .where(eq(sopCategories.id, categoryId))
    .limit(1);

  if (!sourceCat) {
    return NextResponse.json({ error: 'Kategori SOP tidak ditemukan' }, { status: 404 });
  }

  const newCatId = ulid();

  await db.transaction(async (tx) => {
    await tx.insert(sopCategories).values({
      id: newCatId,
      shiftDefinitionId: sourceCat.shiftDefinitionId,
      name: `${sourceCat.name} (Salinan)`,
      sortOrder: sourceCat.sortOrder + 1,
      isActive: true,
    });

    const sourcePoints = await tx
      .select()
      .from(checklistPoints)
      .where(eq(checklistPoints.sopCategoryId, categoryId));

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

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'duplicate_sop_category',
      objectType: 'sop_category',
      objectId: newCatId,
      branchId: sourceCat.branchId,
      after: { originalCategoryId: categoryId, newCatId },
    });
  });

  return NextResponse.json({
    message: 'Kategori SOP berhasil diduplikasi',
    newCategoryId: newCatId,
  });
});
