import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import { notifications } from '../../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const notificationId = new URL(req.url).pathname.split('/').slice(-2)[0];

  const [exists] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, ctx.user.id)))
    .limit(1);

  if (!exists) {
    return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 });
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, ctx.user.id)));

  return NextResponse.json({ status: 'dibaca', notification_id: notificationId });
});
