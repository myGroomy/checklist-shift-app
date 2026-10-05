import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getSignedUrl } from '../../../../lib/storage';
import { withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import { incidents, photos, shiftInstances } from '../../../../drizzle/schema';

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const photoId = new URL(req.url).pathname.split('/').slice(-2)[0];
  const [photo] = await db
    .select({
      id: photos.id,
      fileRef: photos.fileRef,
      shiftInstanceId: photos.shiftInstanceId,
      ownerType: photos.ownerType,
      ownerId: photos.ownerId,
    })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
  }

  if (photo.shiftInstanceId) {
    const [instance] = await db
      .select({ id: shiftInstances.id, branchId: shiftInstances.branchId })
      .from(shiftInstances)
      .where(eq(shiftInstances.id, photo.shiftInstanceId))
      .limit(1);

    if (!instance || !ctx.branchIds.includes(instance.branchId)) {
      return NextResponse.json({ error: 'Akses foto ditolak' }, { status: 403 });
    }
  } else if (photo.ownerType === 'incident') {
    const [incident] = await db
      .select({ id: incidents.id, branchId: incidents.branchId })
      .from(incidents)
      .where(eq(incidents.id, photo.ownerId))
      .limit(1);

    if (!incident || !ctx.branchIds.includes(incident.branchId)) {
      return NextResponse.json({ error: 'Akses foto ditolak' }, { status: 403 });
    }
  }

  const signedUrl = await getSignedUrl(photo.fileRef, 3600);
  return NextResponse.redirect(signedUrl);
});
