import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../lib/db';
import { appendAuditLog } from '../../../../../lib/db/audit';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import { handovers, shiftInstances } from '../../../../../drizzle/schema';

interface HandoverBody {
  values?: Record<string, unknown>;
  free_text?: string;
  no_incident?: boolean;
  noIncidentConfirmed?: boolean;
}

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const pathParts = new URL(req.url).pathname.split('/');
  const shiftInstanceId = pathParts[pathParts.length - 2];

  let body: HandoverBody = {};
  try {
    body = (await req.json()) as HandoverBody;
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 });
  }

  const [instance] = await db
    .select({
      id: shiftInstances.id,
      branchId: shiftInstances.branchId,
      status: shiftInstances.status,
      templateSnapshot: shiftInstances.templateSnapshot,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId))
    .limit(1);

  if (!instance) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  const snapshot = instance.templateSnapshot as {
    handover_fields?: Array<{ id: string; label: string; is_required?: boolean }>;
  };
  const requiredFields = (snapshot.handover_fields ?? []).filter((field) => field.is_required);

  const values = body.values ?? {};
  const missingRequired = requiredFields.filter((field) => {
    const val = values[field.id];
    return val === undefined || val === null || String(val).trim() === '';
  });

  if (missingRequired.length > 0) {
    return NextResponse.json(
      {
        error: 'Field handover wajib belum diisi.',
        missing: missingRequired.map((field) => field.id),
      },
      { status: 400 }
    );
  }

  const now = new Date();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: handovers.id })
        .from(handovers)
        .where(eq(handovers.shiftInstanceId, shiftInstanceId))
        .limit(1);

      const handoverId = existing?.id ?? ulid();

      if (existing) {
        await tx
          .update(handovers)
          .set({
            values: values as Record<string, unknown>,
            freeText: body.free_text ?? null,
            submittedBy: ctx.user.id,
            submittedAt: now,
            updatedAt: now,
          })
          .where(eq(handovers.id, existing.id));
      } else {
        await tx.insert(handovers).values({
          id: handoverId,
          shiftInstanceId,
          values: values as Record<string, unknown>,
          freeText: body.free_text ?? null,
          submittedBy: ctx.user.id,
          submittedAt: now,
        });
      }

      await tx
        .update(shiftInstances)
        .set({
          noIncidentConfirmed: Boolean(body.no_incident ?? body.noIncidentConfirmed),
          updatedAt: now,
        })
        .where(eq(shiftInstances.id, shiftInstanceId));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'submit_handover',
        objectType: 'handover',
        objectId: handoverId,
        branchId: instance.branchId,
        shiftInstanceId,
        before: existing ? { id: existing.id } : null,
        after: {
          submittedBy: ctx.user.id,
          noIncidentConfirmed: Boolean(body.no_incident ?? body.noIncidentConfirmed),
          values,
        },
      });

      return { handoverId, status: existing ? 'diperbarui' : 'dibuat' };
    });

    return NextResponse.json({
      status: 'ok',
      handover_id: result.handoverId,
      action: result.status,
    });
  } catch (error) {
    console.error('Submit handover error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat menyimpan handover' },
      { status: 500 }
    );
  }
});
