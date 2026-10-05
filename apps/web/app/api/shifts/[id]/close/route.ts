import { createHash } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../lib/db';
import { appendAuditLog } from '../../../../../lib/db/audit';
import { getServerTime } from '../../../../../lib/db/server-time';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import { verifyPin } from '../../../../../lib/auth/pin';
import type { AuthContext } from '../../../../../lib/auth/session';
import { entries, handovers, reports, shiftInstances, users } from '../../../../../drizzle/schema';

interface CloseBody {
  pin?: string;
  values?: Record<string, unknown>;
  free_text?: string;
  no_incident?: boolean;
}

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const pathParts = new URL(req.url).pathname.split('/');
  const shiftInstanceId = pathParts[pathParts.length - 2];

  let body: CloseBody = {};
  try {
    body = (await req.json()) as CloseBody;
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 });
  }

  const [instance] = await db
    .select({
      id: shiftInstances.id,
      branchId: shiftInstances.branchId,
      status: shiftInstances.status,
      pjUserId: shiftInstances.pjUserId,
      templateSnapshot: shiftInstances.templateSnapshot,
      shiftDate: shiftInstances.shiftDate,
      noIncidentConfirmed: shiftInstances.noIncidentConfirmed,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  if (instance.pjUserId !== ctx.user.id) {
    return NextResponse.json({ error: 'Hanya PJ yang dapat menutup shift' }, { status: 403 });
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  if (instance.status !== 'berjalan') {
    return NextResponse.json({ error: 'Shift tidak sedang berjalan' }, { status: 409 });
  }

  const [user] = await db
    .select({ pinHash: users.pinHash })
    .from(users)
    .where(eq(users.id, ctx.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
  }

  if (!body.pin || !(await verifyPin(body.pin, user.pinHash))) {
    return NextResponse.json({ error: 'PIN salah. Tutup shift dibatalkan.' }, { status: 400 });
  }

  const snapshot = instance.templateSnapshot as {
    categories?: Array<{ points?: Array<{ point_ref: string; is_required?: boolean }> }>;
    handover_fields?: Array<{ id: string; is_required?: boolean }>;
  };

  const requiredPoints = (snapshot.categories ?? []).flatMap((category) => category.points ?? []);
  const requiredIds = requiredPoints.filter((point) => point.is_required).map((point) => point.point_ref);
  const list = requiredIds.length
    ? await db
        .select({ pointRef: entries.pointRef, state: entries.state })
        .from(entries)
        .where(
          and(
            eq(entries.shiftInstanceId, shiftInstanceId),
            inArray(entries.pointRef, requiredIds)
          )
        )
    : [];

  const invalid = requiredIds.filter((pointRef) => {
    const row = list.find((entry) => entry.pointRef === pointRef);
    return !row || !['selesai', 'skip'].includes(row.state);
  });

  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: 'Ada item wajib yang belum selesai/skip.',
        invalid_points: invalid,
      },
      { status: 400 }
    );
  }

  const requiredHandoverFields = (snapshot.handover_fields ?? []).filter((field) => field.is_required);
  const handoverValues = body.values ?? {};
  const missingHandover = requiredHandoverFields.filter((field) => {
    const val = handoverValues[field.id];
    return val === undefined || val === null || String(val).trim() === '';
  });

  if (missingHandover.length > 0) {
    return NextResponse.json(
      {
        error: 'Field handover wajib belum diisi.',
        missing: missingHandover.map((field) => field.id),
      },
      { status: 400 }
    );
  }

  const now = getServerTime();

  try {
    const result = await db.transaction(async (tx) => {
      const [existingHandover] = await tx
        .select({ id: handovers.id })
        .from(handovers)
        .where(eq(handovers.shiftInstanceId, shiftInstanceId))
        .limit(1);

      if (existingHandover) {
        await tx
          .update(handovers)
          .set({
            values: handoverValues,
            freeText: body.free_text ?? null,
            submittedBy: ctx.user.id,
            submittedAt: now,
            updatedAt: now,
          })
          .where(eq(handovers.id, existingHandover.id));
      } else {
        await tx.insert(handovers).values({
          id: ulid(),
          shiftInstanceId,
          values: handoverValues,
          freeText: body.free_text ?? null,
          submittedBy: ctx.user.id,
          submittedAt: now,
        });
      }

      const contentHash = createHash('sha256')
        .update(
          JSON.stringify({
            shiftInstanceId,
            shiftDate: instance.shiftDate,
            submittedBy: ctx.user.id,
            handoverValues,
            requiredPoints: requiredIds,
            createdAt: now.toISOString(),
          })
        )
        .digest('hex');

      const reportNumber = `R-${instance.shiftDate.replace(/-/g, '')}-${shiftInstanceId.slice(-4)}`;
      const [existingReport] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(eq(reports.shiftInstanceId, shiftInstanceId))
        .limit(1);

      if (!existingReport) {
        await tx.insert(reports).values({
          id: ulid(),
          shiftInstanceId,
          reportNumber,
          generatedBy: ctx.user.id,
          generatedAt: now,
          isLocked: true,
          summaryStats: {
            total_required: requiredIds.length,
            done: list.filter((row) => row.state === 'selesai').length,
            skipped: list.filter((row) => row.state === 'skip').length,
          },
          contentHash,
        });
      }

      await tx
        .update(shiftInstances)
        .set({
          status: 'ditutup',
          closedAt: now,
          closedBy: ctx.user.id,
          closeType: 'normal',
          noIncidentConfirmed: Boolean(body.no_incident),
          updatedAt: now,
        })
        .where(eq(shiftInstances.id, shiftInstanceId));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'close_shift',
        objectType: 'shift_instance',
        objectId: shiftInstanceId,
        branchId: instance.branchId,
        shiftInstanceId,
        after: {
          status: 'ditutup',
          closedBy: ctx.user.id,
          reportNumber,
          handoverValues,
        },
      });

      return { reportNumber };
    });

    return NextResponse.json({ status: 'ditutup', report_number: result.reportNumber });
  } catch (error) {
    console.error('Close shift error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat menutup shift' },
      { status: 500 }
    );
  }
});
