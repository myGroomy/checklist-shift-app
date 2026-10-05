import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { sopCategorySchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import { sopCategories, shiftDefinitions } from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/shifts/[id]/categories -> index pathParts: shiftId is at length - 2
  const shiftId = pathParts[pathParts.length - 2];

  const categories = await db
    .select()
    .from(sopCategories)
    .where(eq(sopCategories.shiftDefinitionId, shiftId))
    .orderBy(sopCategories.sortOrder, desc(sopCategories.createdAt));

  return NextResponse.json({ categories });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const shiftId = pathParts[pathParts.length - 2];

  try {
    const body = await req.json();
    const parseResult = sopCategorySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [shift] = await db
      .select({ id: shiftDefinitions.id, branchId: shiftDefinitions.branchId })
      .from(shiftDefinitions)
      .where(eq(shiftDefinitions.id, shiftId))
      .limit(1);

    if (!shift) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
    }

    const { name, sortOrder, isActive } = parseResult.data;
    const newId = ulid();

    await db.transaction(async (tx) => {
      await tx.insert(sopCategories).values({
        id: newId,
        shiftDefinitionId: shiftId,
        name,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_sop_category',
        objectType: 'sop_category',
        objectId: newId,
        branchId: shift.branchId,
        after: { name, sortOrder },
      });
    });

    return NextResponse.json({
      message: 'Kategori SOP berhasil dibuat',
      categoryId: newId,
    });
  } catch (error) {
    console.error('Create SOP category error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat kategori SOP' },
      { status: 500 }
    );
  }
});
