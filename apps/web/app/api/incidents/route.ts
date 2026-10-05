import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../lib/db';
import { appendAuditLog } from '../../../lib/db/audit';
import { getServerTime } from '../../../lib/db/server-time';
import { requireBranchAccess, withAuth } from '../../../lib/auth/middleware';
import type { AuthContext } from '../../../lib/auth/session';
import { incidentCategories, incidents, shiftInstances } from '../../../drizzle/schema';

interface IncidentBody {
  shiftInstanceId?: string;
  categoryId?: string;
  description?: string;
  occurredAt?: string;
  severity?: 'rendah' | 'sedang' | 'tinggi';
  outsideShift?: boolean;
}

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  let body: IncidentBody = {};
  try {
    body = (await req.json()) as IncidentBody;
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 });
  }

  const categoryId = body.categoryId;
  const description = body.description?.trim();
  if (!categoryId || !description) {
    return NextResponse.json(
      { error: 'categoryId dan description wajib diisi' },
      { status: 400 }
    );
  }

  const now = getServerTime();
  const [category] = await db
    .select({ id: incidentCategories.id, isActive: incidentCategories.isActive })
    .from(incidentCategories)
    .where(eq(incidentCategories.id, categoryId))
    .limit(1);

  if (!category || !category.isActive) {
    return NextResponse.json({ error: 'Kategori incident tidak valid' }, { status: 404 });
  }

  let branchId: string | null = null;
  const shiftInstanceId: string | null = body.shiftInstanceId ?? null;

  if (shiftInstanceId) {
    const [instance] = await db
      .select({
        id: shiftInstances.id,
        branchId: shiftInstances.branchId,
        status: shiftInstances.status,
        closedAt: shiftInstances.closedAt,
        openedAt: shiftInstances.openedAt,
      })
      .from(shiftInstances)
      .where(eq(shiftInstances.id, shiftInstanceId))
      .limit(1);

    if (!instance) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
    }

    const branchAccessError = requireBranchAccess(ctx, instance.branchId);
    if (branchAccessError) return branchAccessError;

    const isActiveShift = instance.status === 'berjalan';
    const isRecentClosedShift =
      instance.status === 'ditutup' || instance.status === 'ditutup_paksa'
        ? instance.closedAt && now.getTime() - new Date(instance.closedAt).getTime() <= 4 * 60 * 60 * 1000
        : false;

    if (!isActiveShift && !isRecentClosedShift) {
      return NextResponse.json({ error: 'Incident hanya dapat dibuat untuk shift berjalan atau ditutup maksimal 4 jam lalu.' }, { status: 400 });
    }

    branchId = instance.branchId;
  } else {
    branchId = ctx.branchIds[0] ?? null;
  }

  if (!branchId) {
    return NextResponse.json({ error: 'Cabang incident tidak ditentukan' }, { status: 400 });
  }

  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : now;
  const incidentId = ulid();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(incidents).values({
        id: incidentId,
        branchId,
        shiftInstanceId,
        categoryId,
        description,
        occurredAt,
        reportedBy: ctx.user.id,
        reportedAt: new Date(),
        status: 'open',
        outsideShift: Boolean(body.outsideShift),
        severity: body.severity ?? null,
        linkSource: 'otomatis',
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_incident',
        objectType: 'incident',
        objectId: incidentId,
        branchId,
        shiftInstanceId: shiftInstanceId ?? undefined,
        after: {
          categoryId,
          description,
          occurredAt: occurredAt.toISOString(),
          severity: body.severity ?? null,
        },
      });
    });

    return NextResponse.json({ status: 'dibuat', incident_id: incidentId });
  } catch (error) {
    console.error('Create incident error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat incident' },
      { status: 500 }
    );
  }
});
