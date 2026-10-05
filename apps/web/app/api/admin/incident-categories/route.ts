import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { incidentCategorySchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../lib/auth/middleware';
import { db } from '../../../../lib/db';
import { incidentCategories } from '../../../../drizzle/schema';
import { appendAuditLog } from '../../../../lib/db/audit';

export const GET = withAuth(async (_req, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const categories = await db
    .select()
    .from(incidentCategories)
    .orderBy(incidentCategories.sortOrder, desc(incidentCategories.createdAt));

  return NextResponse.json({ categories });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const parseResult = incidentCategorySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, sortOrder, isActive } = parseResult.data;

    // Cek duplikasi nama
    const existingName = await db
      .select({ id: incidentCategories.id })
      .from(incidentCategories)
      .where(eq(incidentCategories.name, name))
      .limit(1);

    if (existingName.length > 0) {
      return NextResponse.json(
        { error: `Kategori incident '${name}' sudah ada.` },
        { status: 400 }
      );
    }

    const newId = ulid();

    await db.transaction(async (tx) => {
      await tx.insert(incidentCategories).values({
        id: newId,
        name,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_incident_category',
        objectType: 'incident_category',
        objectId: newId,
        after: { name, sortOrder },
      });
    });

    return NextResponse.json({
      message: 'Kategori incident berhasil dibuat',
      categoryId: newId,
    });
  } catch (error) {
    console.error('Create incident category error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat kategori incident' },
      { status: 500 }
    );
  }
});
