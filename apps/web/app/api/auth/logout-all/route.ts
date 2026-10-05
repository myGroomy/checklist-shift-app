import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/auth/middleware';
import { clearSessionCookie, revokeAllUserSessions } from '../../../../lib/auth/session';
import { db } from '../../../../lib/db';
import { appendAuditLog } from '../../../../lib/db/audit';

export const POST = withAuth(async (_req, ctx) => {
  try {
    await db.transaction(async (tx) => {
      await revokeAllUserSessions(tx, ctx.user.id);
      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'logout_all',
        objectType: 'user',
        objectId: ctx.user.id,
      });
    });

    clearSessionCookie();

    return NextResponse.json({ message: 'Berhasil logout dari semua perangkat' });
  } catch (error) {
    console.error('Logout all error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat logout' },
      { status: 500 }
    );
  }
});
