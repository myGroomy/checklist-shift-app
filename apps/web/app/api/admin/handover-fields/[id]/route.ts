import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { handoverFieldSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { db } from '../../../../../lib/db';
import { handoverFields, shiftDefinitions } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = handoverFieldSchema.partial().safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: handoverFields.id,
        label: handoverFields.label,
        fieldType: handoverFields.fieldType,
        branchId: shiftDefinitions.branchId,
      })
      .from(handoverFields)
      .innerJoin(shiftDefinitions, eq(handoverFields.shiftDefinitionId, shiftDefinitions.id))
      .where(eq(handoverFields.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Bidang serah terima tidak ditemukan' }, { status: 404 });
    }

    const updateData = parseResult.data;
    const dbUpdate: Partial<typeof handoverFields.$inferInsert> = { updatedAt: new Date() };

    if (updateData.label !== undefined) dbUpdate.label = updateData.label;
    if (updateData.fieldType !== undefined) dbUpdate.fieldType = updateData.fieldType;
    if (updateData.options !== undefined) dbUpdate.options = updateData.options ? JSON.stringify(updateData.options) : null;
    if (updateData.isRequired !== undefined) dbUpdate.isRequired = updateData.isRequired;
    if (updateData.sortOrder !== undefined) dbUpdate.sortOrder = updateData.sortOrder;
    if (updateData.isActive !== undefined) dbUpdate.isActive = updateData.isActive;

    await db.transaction(async (tx) => {
      await tx
        .update(handoverFields)
        .set(dbUpdate)
        .where(eq(handoverFields.id, id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_handover_field',
        objectType: 'handover_field',
        objectId: id,
        branchId: existing.branchId,
        before: existing,
        after: { ...existing, ...updateData },
      });
    });

    return NextResponse.json({ message: 'Bidang serah terima berhasil diperbarui' });
  } catch (error) {
    console.error('Update handover field error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui bidang serah terima' },
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
      id: handoverFields.id,
      branchId: shiftDefinitions.branchId,
    })
    .from(handoverFields)
    .innerJoin(shiftDefinitions, eq(handoverFields.shiftDefinitionId, shiftDefinitions.id))
    .where(eq(handoverFields.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Bidang serah terima tidak ditemukan' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(handoverFields)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(handoverFields.id, id));

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'deactivate_handover_field',
      objectType: 'handover_field',
      objectId: id,
      branchId: existing.branchId,
      before: { isActive: true },
      after: { isActive: false },
    });
  });

  return NextResponse.json({ message: 'Bidang serah terima berhasil dinonaktifkan' });
});
