import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/auth/middleware';

export const GET = withAuth(async (_req, ctx) => {
  return NextResponse.json({
    user: ctx.user,
    branchIds: ctx.branchIds,
    sessionId: ctx.session.id,
  });
});
