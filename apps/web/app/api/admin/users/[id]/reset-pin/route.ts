import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { sensitiveActionSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { hashPin } from '../../../../../../lib/auth/pin';
import { verifyAdminPin } from '../../../../../../lib/auth/sensitive-action';
import { db } from '../../../../../../lib/db';
import { users } from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/users/[id]/reset-pin -> index pathParts: id is at length - 2
  const targetUserId = pathParts[pathParts.length - 2];

  try {
    const body = await req.json();
    const parseResult = sensitiveActionSchema.extend({
      newPin: sensitiveActionSchema.shape.pin,
    }).safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { pin: adminPin, reason, newPin } = parseResult.data;

    // Verifikasi PIN Admin
    const pinErr = await verifyAdminPin(ctx.user.id, adminPin);
    if (pinErr) {
      return NextResponse.json({ error: pinErr }, { status: 403 });
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const newPinHash = await hashPin(newPin);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          pinHash: newPinHash,
          mustChangePin: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'admin_reset_pin',
        objectType: 'user',
        objectId: targetUserId,
        reason,
      });
    });

    return NextResponse.json({ message: 'PIN user berhasil direset oleh Admin' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat mereset PIN' },
      { status: 500 }
    );
  }
});
