import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { branchSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { isValidTimeZone } from '../../../../../lib/valid-timezone';
import { db } from '../../../../../lib/db';
import { branches } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = branchSchema.partial().safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(branches)
      .where(eq(branches.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 });
    }

    const updateData = parseResult.data;

    if (updateData.timezone !== undefined && !isValidTimeZone(updateData.timezone)) {
      return NextResponse.json(
        { error: `Timezone '${updateData.timezone}' bukan zona waktu IANA yang valid (misal: Asia/Jakarta).` },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(branches)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(branches.id, id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_branch',
        objectType: 'branch',
        objectId: id,
        branchId: id,
        before: existing,
        after: { ...existing, ...updateData },
      });
    });

    return NextResponse.json({ message: 'Cabang berhasil diperbarui' });
  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat mengedit cabang' },
      { status: 500 }
    );
  }
});
