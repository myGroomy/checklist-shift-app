import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { handoverFieldSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import { handoverFields, shiftDefinitions } from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/shifts/[id]/handover-fields -> index pathParts: shiftId is at length - 2
  const shiftId = pathParts[pathParts.length - 2];

  const fields = await db
    .select()
    .from(handoverFields)
    .where(eq(handoverFields.shiftDefinitionId, shiftId))
    .orderBy(handoverFields.sortOrder);

  return NextResponse.json({ fields });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const shiftId = pathParts[pathParts.length - 2];

  try {
    const body = await req.json();
    const parseResult = handoverFieldSchema.safeParse(body);

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

    const { label, fieldType, options, isRequired, sortOrder, isActive } = parseResult.data;
    const newId = ulid();

    await db.transaction(async (tx) => {
      await tx.insert(handoverFields).values({
        id: newId,
        shiftDefinitionId: shiftId,
        label,
        fieldType,
        options: options ? JSON.stringify(options) : null,
        isRequired: isRequired ?? true,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_handover_field',
        objectType: 'handover_field',
        objectId: newId,
        branchId: shift.branchId,
        after: { label, fieldType },
      });
    });

    return NextResponse.json({
      message: 'Bidang serah terima berhasil dibuat',
      fieldId: newId,
    });
  } catch (error) {
    console.error('Create handover field error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat bidang serah terima' },
      { status: 500 }
    );
  }
});
