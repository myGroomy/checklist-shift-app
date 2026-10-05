import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { checklistPointSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import { checklistPoints, sopCategories, shiftDefinitions } from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/sop-categories/[id]/points -> index pathParts: categoryId is at length - 2
  const categoryId = pathParts[pathParts.length - 2];

  const points = await db
    .select()
    .from(checklistPoints)
    .where(eq(checklistPoints.sopCategoryId, categoryId))
    .orderBy(checklistPoints.sortOrder, desc(checklistPoints.createdAt));

  return NextResponse.json({ points });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const categoryId = pathParts[pathParts.length - 2];

  try {
    const body = await req.json();
    const parseResult = checklistPointSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [category] = await db
      .select({
        id: sopCategories.id,
        branchId: shiftDefinitions.branchId,
      })
      .from(sopCategories)
      .innerJoin(shiftDefinitions, eq(sopCategories.shiftDefinitionId, shiftDefinitions.id))
      .where(eq(sopCategories.id, categoryId))
      .limit(1);

    if (!category) {
      return NextResponse.json({ error: 'Kategori SOP tidak ditemukan' }, { status: 404 });
    }

    const {
      title,
      instruction,
      inputType,
      isRequired,
      targetTime,
      toleranceMinutes,
      activeDays,
      numberMin,
      numberMax,
      sortOrder,
      isActive,
    } = parseResult.data;

    const newId = ulid();

    await db.transaction(async (tx) => {
      await tx.insert(checklistPoints).values({
        id: newId,
        sopCategoryId: categoryId,
        title,
        instruction: instruction ?? null,
        inputType,
        isRequired: isRequired ?? true,
        targetTime: targetTime ?? null,
        toleranceMinutes: toleranceMinutes ?? 15,
        activeDays: activeDays.join(','),
        numberMin: numberMin ?? null,
        numberMax: numberMax ?? null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_checklist_point',
        objectType: 'checklist_point',
        objectId: newId,
        branchId: category.branchId,
        after: { title, inputType, activeDays },
      });
    });

    return NextResponse.json({
      message: 'Checklist point berhasil dibuat',
      pointId: newId,
    });
  } catch (error) {
    console.error('Create checklist point error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat checklist point' },
      { status: 500 }
    );
  }
});
