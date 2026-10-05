import { and, desc, eq, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { branches, reports, shiftDefinitions, shiftInstances, users } from '@/drizzle/schema';

export const GET = withAuth(async (request: NextRequest, ctx) => {
  const roleError = requireRole(ctx, 'admin');
  if (roleError) return roleError;

  const params = request.nextUrl.searchParams;
  const branchId = params.get('branchId');
  const shiftDate = params.get('date');
  const conditions = [ne(shiftInstances.status, 'void'), eq(shiftInstances.isTest, false)];

  if (branchId) conditions.push(eq(shiftInstances.branchId, branchId));
  if (shiftDate) conditions.push(eq(shiftInstances.shiftDate, shiftDate));

  const rows = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      generatedAt: reports.generatedAt,
      isLocked: reports.isLocked,
      archivePdfDriveUrl: reports.archivePdfDriveUrl,
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
    .where(and(...conditions))
    .orderBy(desc(shiftInstances.shiftDate), desc(reports.generatedAt))
    .limit(100);

  return NextResponse.json({
    reports: rows.map((row) => ({
      ...row,
      shiftDate: row.shiftDate,
      generatedAt: row.generatedAt.toISOString(),
      archivePdfDriveUrl: row.archivePdfDriveUrl,
    })),
  });
});
