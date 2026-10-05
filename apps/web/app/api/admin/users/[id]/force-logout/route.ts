import { NextRequest, NextResponse } from 'next/server';
import { sensitiveActionSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { verifyAdminPin } from '../../../../../../lib/auth/sensitive-action';
import { revokeAllUserSessions } from '../../../../../../lib/auth/session';
import { db } from '../../../../../../lib/db';
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
      await revokeAllUserSessions(tx, targetUserId);
      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'admin_force_logout',
        objectType: 'user',
        objectId: targetUserId,
        reason,
      });
    });

    return NextResponse.json({ message: 'User berhasil dipaksa logout dari semua perangkat' });
  } catch (error) {
    console.error('Force logout error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memaksa logout user' },
      { status: 500 }
    );
  }
});
