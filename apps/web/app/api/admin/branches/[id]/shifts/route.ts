import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { shiftDefinitionSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import { shiftDefinitions, branches } from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/branches/[id]/shifts -> index pathParts: branchId is at length - 2
  const branchId = pathParts[pathParts.length - 2];

  const shifts = await db
    .select()
    .from(shiftDefinitions)
    .where(eq(shiftDefinitions.branchId, branchId))
    .orderBy(shiftDefinitions.sortOrder, desc(shiftDefinitions.createdAt));

  return NextResponse.json({ shifts });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const branchId = pathParts[pathParts.length - 2];

  try {
    const body = await req.json();
    const parseResult = shiftDefinitionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [branch] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);

    if (!branch) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 });
    }

    const { name, startTime, endTime, crossesMidnight, sortOrder, isActive } = parseResult.data;
    const newId = ulid();

    await db.transaction(async (tx) => {
      await tx.insert(shiftDefinitions).values({
        id: newId,
        branchId,
        name,
        startTime,
        endTime,
        crossesMidnight: crossesMidnight ?? false,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_shift_definition',
        objectType: 'shift_definition',
        objectId: newId,
        branchId,
        after: { name, startTime, endTime, crossesMidnight },
      });
    });

    return NextResponse.json({
      message: 'Definisi shift berhasil dibuat',
      shiftId: newId,
    });
  } catch (error) {
    console.error('Create shift definition error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat definisi shift' },
      { status: 500 }
    );
  }
});
