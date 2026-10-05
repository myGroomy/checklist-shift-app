import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { shiftDefinitionSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { db } from '../../../../../lib/db';
import { shiftDefinitions } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = shiftDefinitionSchema.partial().safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(shiftDefinitions)
      .where(eq(shiftDefinitions.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Definisi shift tidak ditemukan' }, { status: 404 });
    }

    const updateData = parseResult.data;

    await db.transaction(async (tx) => {
      await tx
        .update(shiftDefinitions)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(shiftDefinitions.id, id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_shift_definition',
        objectType: 'shift_definition',
        objectId: id,
        branchId: existing.branchId,
        before: existing,
        after: { ...existing, ...updateData },
      });
    });

    return NextResponse.json({ message: 'Definisi shift berhasil diperbarui' });
  } catch (error) {
    console.error('Update shift definition error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui definisi shift' },
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
    .select()
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Definisi shift tidak ditemukan' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(shiftDefinitions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shiftDefinitions.id, id));

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'deactivate_shift_definition',
      objectType: 'shift_definition',
      objectId: id,
      branchId: existing.branchId,
      before: { isActive: existing.isActive },
      after: { isActive: false },
    });
  });

  return NextResponse.json({ message: 'Shift berhasil dinonaktifkan' });
});
