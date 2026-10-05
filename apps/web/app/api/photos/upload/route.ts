import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../lib/db';
import { uploadFile } from '../../../../lib/storage';
import { withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import { handovers, incidents, photos, shiftInstances } from '../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const formData = await req.formData();
  const file = formData.get('file');
  const ownerType = String(formData.get('ownerType') ?? 'incident');
  const ownerId = String(formData.get('ownerId') ?? '');
  const shiftInstanceId = formData.get('shiftInstanceId')?.toString() ?? null;

  if (!(file instanceof File) || !ownerId) {
    return NextResponse.json({ error: 'file dan ownerId wajib diisi' }, { status: 400 });
  }

  if (ownerType !== 'entry' && ownerType !== 'handover' && ownerType !== 'incident') {
    return NextResponse.json({ error: 'Jenis pemilik foto tidak valid.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File harus berupa gambar.' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran foto maksimal 5 MB.' }, { status: 400 });
  }

  const safeOwnerType = ownerType;

  let branchId: string | null = null;
  let resolvedShiftInstanceId = shiftInstanceId;
  if (shiftInstanceId) {
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
    branchId = instance.branchId;
    if (safeOwnerType !== 'incident' && instance.status !== 'berjalan') {
      return NextResponse.json({ error: 'Foto hanya dapat ditambahkan pada shift berjalan.' }, { status: 409 });
    }
    if (safeOwnerType === 'entry') {
      const snapshot = instance.templateSnapshot as {
        categories?: Array<{ points?: Array<{ point_ref: string }> }>;
      };
      const pointExists = (snapshot.categories ?? [])
        .some((category) => (category.points ?? []).some((point) => point.point_ref === ownerId));
      if (!pointExists) {
        return NextResponse.json({ error: 'Item foto tidak ditemukan pada shift ini.' }, { status: 404 });
      }
    }
  }

  if (branchId && !ctx.branchIds.includes(branchId)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  if (safeOwnerType === 'incident') {
    const [incident] = await db
      .select({ branchId: incidents.branchId, shiftInstanceId: incidents.shiftInstanceId })
      .from(incidents)
      .where(eq(incidents.id, ownerId))
      .limit(1);
    if (!incident) return NextResponse.json({ error: 'Incident tidak ditemukan.' }, { status: 404 });
    if (!ctx.branchIds.includes(incident.branchId)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (shiftInstanceId && incident.shiftInstanceId !== shiftInstanceId) {
      return NextResponse.json({ error: 'Foto tidak sesuai dengan shift incident.' }, { status: 400 });
    }
    resolvedShiftInstanceId = incident.shiftInstanceId;
    branchId = incident.branchId;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(photos)
      .where(and(eq(photos.ownerType, 'incident'), eq(photos.ownerId, ownerId)));

    if ((countRow?.count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Foto incident maksimal 5.' }, { status: 400 });
    }
  }

  if (safeOwnerType === 'handover') {
    const [handover] = await db
      .select({ shiftInstanceId: handovers.shiftInstanceId })
      .from(handovers)
      .where(eq(handovers.id, ownerId))
      .limit(1);
    if (!handover) return NextResponse.json({ error: 'Handover tidak ditemukan.' }, { status: 404 });
    if (shiftInstanceId && handover.shiftInstanceId !== shiftInstanceId) {
      return NextResponse.json({ error: 'Foto tidak sesuai dengan handover.' }, { status: 400 });
    }
    resolvedShiftInstanceId = handover.shiftInstanceId;
    const [instance] = await db
      .select({ branchId: shiftInstances.branchId, status: shiftInstances.status })
      .from(shiftInstances)
      .where(eq(shiftInstances.id, handover.shiftInstanceId))
      .limit(1);
    if (!instance || instance.status !== 'berjalan') {
      return NextResponse.json({ error: 'Handover shift tidak tersedia untuk diubah.' }, { status: 409 });
    }
    if (!ctx.branchIds.includes(instance.branchId)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    branchId = instance.branchId;
  }

  if (safeOwnerType !== 'incident' && !shiftInstanceId) {
    return NextResponse.json({ error: 'shiftInstanceId wajib untuk foto checklist/handover.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : null;
  if (!ext) return NextResponse.json({ error: 'Format foto yang didukung: WebP, PNG, JPEG.' }, { status: 400 });
  const photoId = ulid();
  const path = `${branchId ?? 'global'}/${resolvedShiftInstanceId ?? 'general'}/${photoId}.${ext}`;

  const storedPath = await uploadFile(path, buffer, file.type || 'image/webp');
  const photoRowId = ulid();

  await db.insert(photos).values({
    id: photoRowId,
    shiftInstanceId: resolvedShiftInstanceId ?? null,
    ownerType: safeOwnerType,
    ownerId,
    fileRef: storedPath,
    mime: file.type || 'image/webp',
    sizeBytes: buffer.length,
    status: 'uploaded',
    uploadedBy: ctx.user.id,
    uploadedAt: new Date(),
  });

  return NextResponse.json({ status: 'uploaded', photo_id: photoRowId, file_ref: storedPath });
});
