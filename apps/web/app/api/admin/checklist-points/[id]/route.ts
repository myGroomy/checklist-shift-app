import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { checklistPointSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { db } from '../../../../../lib/db';
import { checklistPoints, sopCategories, shiftDefinitions } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = checklistPointSchema.partial().safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: checklistPoints.id,
        title: checklistPoints.title,
        inputType: checklistPoints.inputType,
        activeDays: checklistPoints.activeDays,
        branchId: shiftDefinitions.branchId,
      })
      .from(checklistPoints)
      .innerJoin(sopCategories, eq(checklistPoints.sopCategoryId, sopCategories.id))
      .innerJoin(shiftDefinitions, eq(sopCategories.shiftDefinitionId, shiftDefinitions.id))
      .where(eq(checklistPoints.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Checklist point tidak ditemukan' }, { status: 404 });
    }

    const updateData = parseResult.data;
    const dbUpdate: Partial<typeof checklistPoints.$inferInsert> = { updatedAt: new Date() };

    if (updateData.title !== undefined) dbUpdate.title = updateData.title;
    if (updateData.instruction !== undefined) dbUpdate.instruction = updateData.instruction;
    if (updateData.inputType !== undefined) dbUpdate.inputType = updateData.inputType;
    if (updateData.isRequired !== undefined) dbUpdate.isRequired = updateData.isRequired;
    if (updateData.targetTime !== undefined) dbUpdate.targetTime = updateData.targetTime;
    if (updateData.toleranceMinutes !== undefined) dbUpdate.toleranceMinutes = updateData.toleranceMinutes;
    if (updateData.activeDays !== undefined) dbUpdate.activeDays = updateData.activeDays.join(',');
    if (updateData.numberMin !== undefined) dbUpdate.numberMin = updateData.numberMin;
    if (updateData.numberMax !== undefined) dbUpdate.numberMax = updateData.numberMax;
    if (updateData.sortOrder !== undefined) dbUpdate.sortOrder = updateData.sortOrder;
    if (updateData.isActive !== undefined) dbUpdate.isActive = updateData.isActive;

    await db.transaction(async (tx) => {
      await tx
        .update(checklistPoints)
        .set(dbUpdate)
        .where(eq(checklistPoints.id, id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_checklist_point',
        objectType: 'checklist_point',
        objectId: id,
        branchId: existing.branchId,
        before: existing,
        after: { ...existing, ...updateData },
      });
    });

    return NextResponse.json({ message: 'Checklist point berhasil diperbarui' });
  } catch (error) {
    console.error('Update checklist point error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui checklist point' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  const [existing] = await db
    .select({
      id: checklistPoints.id,
      branchId: shiftDefinitions.branchId,
    })
    .from(checklistPoints)
    .innerJoin(sopCategories, eq(checklistPoints.sopCategoryId, sopCategories.id))
    .innerJoin(shiftDefinitions, eq(sopCategories.shiftDefinitionId, shiftDefinitions.id))
    .where(eq(checklistPoints.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Checklist point tidak ditemukan' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(checklistPoints)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(checklistPoints.id, id));

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'deactivate_checklist_point',
      objectType: 'checklist_point',
      objectId: id,
      branchId: existing.branchId,
      before: { isActive: true },
      after: { isActive: false },
    });
  });

  return NextResponse.json({ message: 'Checklist point berhasil dinonaktifkan' });
});
