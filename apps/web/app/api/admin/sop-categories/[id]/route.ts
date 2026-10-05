import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { sopCategorySchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { db } from '../../../../../lib/db';
import { sopCategories, shiftDefinitions } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = sopCategorySchema.partial().safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
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
      .where(eq(sopCategories.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Kategori SOP tidak ditemukan' }, { status: 404 });
    }

    const updateData = parseResult.data;

    await db.transaction(async (tx) => {
      await tx
        .update(sopCategories)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(sopCategories.id, id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_sop_category',
        objectType: 'sop_category',
        objectId: id,
        branchId: existing.branchId,
        before: existing,
        after: { ...existing, ...updateData },
      });
    });

    return NextResponse.json({ message: 'Kategori SOP berhasil diperbarui' });
  } catch (error) {
    console.error('Update SOP category error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui kategori SOP' },
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
      id: sopCategories.id,
      isActive: sopCategories.isActive,
      branchId: shiftDefinitions.branchId,
    })
    .from(sopCategories)
    .innerJoin(shiftDefinitions, eq(sopCategories.shiftDefinitionId, shiftDefinitions.id))
    .where(eq(sopCategories.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Kategori SOP tidak ditemukan' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sopCategories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sopCategories.id, id));

    await appendAuditLog(tx, {
      actorId: ctx.user.id,
      action: 'deactivate_sop_category',
      objectType: 'sop_category',
      objectId: id,
      branchId: existing.branchId,
      before: { isActive: existing.isActive },
      after: { isActive: false },
    });
  });

  return NextResponse.json({ message: 'Kategori SOP berhasil dinonaktifkan' });
});
