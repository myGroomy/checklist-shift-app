import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../lib/db';
import { uploadFile } from '../../../../lib/storage';
import { withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import { photos, shiftInstances } from '../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const formData = await req.formData();
  const file = formData.get('file');
  const ownerType = String(formData.get('ownerType') ?? 'incident');
  const ownerId = String(formData.get('ownerId') ?? '');
  const shiftInstanceId = formData.get('shiftInstanceId')?.toString() ?? null;

  if (!(file instanceof File) || !ownerId) {
    return NextResponse.json({ error: 'file dan ownerId wajib diisi' }, { status: 400 });
  }

  const safeOwnerType = ownerType === 'entry' || ownerType === 'handover' || ownerType === 'incident'
    ? ownerType
    : 'incident';

  let branchId: string | null = null;
  if (shiftInstanceId) {
    const [instance] = await db
      .select({ id: shiftInstances.id, branchId: shiftInstances.branchId })
      .from(shiftInstances)
      .where(eq(shiftInstances.id, shiftInstanceId))
      .limit(1);

    if (!instance) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
    }
    branchId = instance.branchId;
  }

  if (branchId && !ctx.branchIds.includes(branchId)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  if (safeOwnerType === 'incident') {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(photos)
      .where(and(eq(photos.ownerType, 'incident'), eq(photos.ownerId, ownerId)));

    if ((countRow?.count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Foto incident maksimal 5.' }, { status: 400 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'webp' : 'webp';
  const photoId = ulid();
  const path = `${branchId ?? 'global'}/${shiftInstanceId ?? 'general'}/${photoId}.${ext}`;

  const storedPath = await uploadFile(path, buffer, file.type || 'image/webp');
  const photoRowId = ulid();

  await db.insert(photos).values({
    id: photoRowId,
    shiftInstanceId: shiftInstanceId ?? null,
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
