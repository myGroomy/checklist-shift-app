import { NextResponse } from 'next/server';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { requireRole, withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { branches, incidents, reports, shiftDefinitions, shiftInstances } from '@/drizzle/schema';

export const GET = withAuth(async (_req, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [branchTotal, activeShiftCount, openIncidentCount, reportsTodayCount, branchStats, alerts] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(branches)
        .where(eq(branches.isActive, true)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(shiftInstances)
        .where(eq(shiftInstances.status, 'berjalan')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(eq(incidents.status, 'open')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(gte(reports.generatedAt, todayStart)),
      db
        .select({
          id: branches.id,
          name: branches.name,
          code: branches.code,
          activeShifts: sql<number>`COALESCE((SELECT COUNT(*) FROM shift_instances si WHERE si.branch_id = "branches"."id" AND si.status = 'berjalan'), 0)`,
          openIncidents: sql<number>`COALESCE((SELECT COUNT(*) FROM incidents i WHERE i.branch_id = "branches"."id" AND i.status = 'open'), 0)`,
          reportsToday: sql<number>`COALESCE((SELECT COUNT(*) FROM reports r JOIN shift_instances si ON si.id = r.shift_instance_id WHERE si.branch_id = "branches"."id" AND r.generated_at >= ${todayStart.toISOString()}::timestamptz), 0)`,
        })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name),
      db
        .select({
          branchName: branches.name,
          shiftName: shiftDefinitions.name,
          openedAt: shiftInstances.openedAt,
          pjName: sql<string>`(SELECT u.name FROM users u WHERE u.id = ${shiftInstances.pjUserId})`,
        })
        .from(shiftInstances)
        .leftJoin(reports, eq(shiftInstances.id, reports.shiftInstanceId))
        .leftJoin(branches, eq(shiftInstances.branchId, branches.id))
        .leftJoin(shiftDefinitions, eq(shiftInstances.shiftDefinitionId, shiftDefinitions.id))
        .where(and(eq(shiftInstances.status, 'berjalan'), isNull(reports.id)))
        .orderBy(desc(shiftInstances.openedAt))
        .limit(8),
    ]);

  return NextResponse.json({
    stats: {
      branches: Number(branchTotal[0]?.count ?? 0),
      activeShifts: Number(activeShiftCount[0]?.count ?? 0),
      openIncidents: Number(openIncidentCount[0]?.count ?? 0),
      reportsToday: Number(reportsTodayCount[0]?.count ?? 0),
    },
    branches: branchStats.map((branch) => ({
      ...branch,
      activeShifts: Number(branch.activeShifts),
      openIncidents: Number(branch.openIncidents),
      reportsToday: Number(branch.reportsToday),
    })),
    alerts: alerts.map((alert) => ({
      ...alert,
      openedAt: alert.openedAt?.toISOString() ?? null,
    })),
  });
});
