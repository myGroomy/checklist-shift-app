import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { sensitiveActionSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { verifyAdminPin } from '../../../../../../lib/auth/sensitive-action';
import { db } from '../../../../../../lib/db';
import { users, pinFailAttempts } from '../../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const targetUserId = pathParts[pathParts.length - 2];

  try {
    const body = await req.json();
    const parseResult = sensitiveActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { pin: adminPin, reason } = parseResult.data;

    // Verifikasi PIN Admin
    const pinErr = await verifyAdminPin(ctx.user.id, adminPin);
    if (pinErr) {
      return NextResponse.json({ error: pinErr }, { status: 403 });
    }

    await db.transaction(async (tx) => {
      // Clear lockedUntil
      await tx
        .update(users)
        .set({ lockedUntil: null, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

      // Reset pin_fail_attempts count = 0 (BR-40: tidak menghapus baris)
      await tx
        .update(pinFailAttempts)
        .set({ count: 0, lastAttemptAt: new Date() })
        .where(eq(pinFailAttempts.userId, targetUserId));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'admin_unlock_account',
        objectType: 'user',
        objectId: targetUserId,
        reason,
      });
    });

    return NextResponse.json({ message: 'Kunci akun berhasil dibuka' });
  } catch (error) {
    console.error('Unlock account error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuka kunci akun' },
      { status: 500 }
    );
  }
});
