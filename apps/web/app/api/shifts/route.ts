import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { getServerTime } from '../../../lib/db/server-time';
import { getShiftDate } from '../../../lib/shift/time';
import { withAuth } from '../../../lib/auth/middleware';
import type { AuthContext } from '../../../lib/auth/session';
import {
  branches,
  shiftDefinitions,
  shiftInstances,
} from '../../../drizzle/schema';

/**
 * Daftar shift untuk petugas (Fase 4): definisi shift aktif pada cabang yang
 * diakses + status instance hari ini (belum dibuka / berjalan / ditutup).
 */
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const branchIdParam = new URL(req.url).searchParams.get('branchId');
  const branchIds = branchIdParam
    ? ctx.branchIds.filter((id) => id === branchIdParam)
    : ctx.branchIds;

  if (branchIds.length === 0) {
    return NextResponse.json({ branches: [], shifts: [] });
  }

  const branchRows = await db
    .select({ id: branches.id, name: branches.name, code: branches.code, timezone: branches.timezone })
    .from(branches)
    .where(and(inArray(branches.id, branchIds), eq(branches.isActive, true)));

  const definitions = await db
    .select({
      id: shiftDefinitions.id,
      branchId: shiftDefinitions.branchId,
      name: shiftDefinitions.name,
      startTime: shiftDefinitions.startTime,
      endTime: shiftDefinitions.endTime,
      crossesMidnight: shiftDefinitions.crossesMidnight,
      sortOrder: shiftDefinitions.sortOrder,
    })
    .from(shiftDefinitions)
    .where(and(inArray(shiftDefinitions.branchId, branchIds), eq(shiftDefinitions.isActive, true)))
    .orderBy(shiftDefinitions.sortOrder);

  const now = getServerTime();
  const timezoneByBranch = new Map(branchRows.map((b) => [b.id, b.timezone] as const));
  const todayByBranch = new Map<string, string>();
  const branchDateConditions = branchRows.map((branch) => {
    const shiftDate = getShiftDate(now, branch.timezone);
    todayByBranch.set(branch.id, shiftDate);
    return and(
      eq(shiftInstances.branchId, branch.id),
      eq(shiftInstances.shiftDate, shiftDate)
    );
  });
  const branchDateFilter = or(...branchDateConditions) ?? sql`false`;

  // Batasi instance sejak query; pasangan cabang/tanggal mengikuti zona waktu
  // masing-masing cabang dan memakai index branch_date.
  const instances = await db
    .select({
      id: shiftInstances.id,
      shiftDefinitionId: shiftInstances.shiftDefinitionId,
      branchId: shiftInstances.branchId,
      shiftDate: shiftInstances.shiftDate,
      status: shiftInstances.status,
      pjUserId: shiftInstances.pjUserId,
      openedOutsideHours: shiftInstances.openedOutsideHours,
    })
    .from(shiftInstances)
    .where(
      and(
        branchDateFilter,
        sql`${shiftInstances.status} <> 'void'`
      )
    );

  const instanceByDefinition = new Map<string, (typeof instances)[number]>();
  for (const inst of instances) {
    if (inst.shiftDate === todayByBranch.get(inst.branchId)) {
      instanceByDefinition.set(inst.shiftDefinitionId, inst);
    }
  }

  return NextResponse.json({
    branches: branchRows,
    shifts: definitions.map((def) => {
      const instance = instanceByDefinition.get(def.id);
      const timezone = timezoneByBranch.get(def.branchId) ?? 'Asia/Jakarta';
      return {
        ...def,
        timezone,
        today: getShiftDate(now, timezone),
        instance: instance
          ? {
              shift_instance_id: instance.id,
              status: instance.status,
              pj_user_id: instance.pjUserId,
              opened_outside_hours: instance.openedOutsideHours,
            }
          : null,
      };
    }),
    server_time: now.toISOString(),
  });
});