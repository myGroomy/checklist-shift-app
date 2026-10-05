import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { incidentCategorySchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { db } from '../../../../../lib/db';
import { incidentCategories } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = incidentCategorySchema.partial().safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(incidentCategories)
      .where(eq(incidentCategories.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Kategori incident tidak ditemukan' }, { status: 404 });
    }

    const updateData = parseResult.data;

    await db.transaction(async (tx) => {
      await tx
        .update(incidentCategories)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(incidentCategories.id, id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_incident_category',
        objectType: 'incident_category',
        objectId: id,
        before: existing,
        after: { ...existing, ...updateData },
      });
    });

    return NextResponse.json({ message: 'Kategori incident berhasil diperbarui' });
  } catch (error) {
    console.error('Update incident category error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui kategori incident' },
      { status: 500 }
    );
  }
});
