import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/auth/middleware';
import { clearSessionCookie, revokeSession } from '../../../../lib/auth/session';
import { db } from '../../../../lib/db';
import { appendAuditLog } from '../../../../lib/db/audit';

export const POST = withAuth(async (_req, ctx) => {
  try {
    await db.transaction(async (tx) => {
      await revokeSession(tx, ctx.session.id);
      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'logout',
        objectType: 'session',
        objectId: ctx.session.id,
      });
    });

    clearSessionCookie();

    return NextResponse.json({ message: 'Berhasil logout' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat logout' },
      { status: 500 }
    );
  }
});
