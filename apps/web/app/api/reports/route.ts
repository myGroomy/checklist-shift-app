import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { withAuth } from '../../../lib/auth/middleware';
import type { AuthContext } from '../../../lib/auth/session';
import { branches, reports, shiftDefinitions, shiftInstances, users } from '../../../drizzle/schema';

export const GET = withAuth(async (_req, ctx: AuthContext) => {
  if (ctx.branchIds.length === 0) return NextResponse.json({ reports: [] });

  const rows = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      generatedAt: reports.generatedAt,
      branchId: branches.id,
      branchName: branches.name,
      branchCode: branches.code,
      shiftName: shiftDefinitions.name,
      shiftDate: shiftInstances.shiftDate,
      shiftStatus: shiftInstances.status,
      pjName: users.name,
    })
    .from(reports)
    .innerJoin(shiftInstances, eq(reports.shiftInstanceId, shiftInstances.id))
    .innerJoin(branches, eq(shiftInstances.branchId, branches.id))
    .innerJoin(shiftDefinitions, eq(shiftInstances.shiftDefinitionId, shiftDefinitions.id))
    .leftJoin(users, eq(shiftInstances.pjUserId, users.id))
    .where(and(
      inArray(shiftInstances.branchId, ctx.branchIds),
      ne(shiftInstances.status, 'void'),
      eq(shiftInstances.isTest, false)
    ))
    .orderBy(desc(shiftInstances.shiftDate), desc(reports.generatedAt))
    .limit(100);

  return NextResponse.json({
    reports: rows.map((row) => ({
      ...row,
      shiftDate: row.shiftDate,
      generatedAt: row.generatedAt.toISOString(),
    })),
  });
});
