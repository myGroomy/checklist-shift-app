import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { withAuth } from '../../../lib/auth/middleware';
import type { AuthContext } from '../../../lib/auth/session';
import { notifications } from '../../../drizzle/schema';

export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, ctx.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      read_at: row.readAt,
      created_at: row.createdAt,
    })),
  });
});
