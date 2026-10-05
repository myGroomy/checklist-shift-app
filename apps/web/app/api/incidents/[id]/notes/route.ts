import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../lib/db';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import { incidentNotes, incidents } from '../../../../../drizzle/schema';

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const incidentId = new URL(req.url).pathname.split('/').slice(-2)[0];
  let body: { note?: string } = {};
  try {
    body = (await req.json()) as { note?: string };
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 });
  }

  const note = body.note?.trim();
  if (!note) {
    return NextResponse.json({ error: 'note wajib diisi' }, { status: 400 });
  }

  const [incident] = await db
    .select({ id: incidents.id, branchId: incidents.branchId })
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) {
    return NextResponse.json({ error: 'Incident tidak ditemukan' }, { status: 404 });
  }
  const branchAccessError = requireBranchAccess(ctx, incident.branchId);
  if (branchAccessError) return branchAccessError;
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Catatan maksimal 2000 karakter.' }, { status: 400 });
  }

  const rowId = ulid();
  await db.insert(incidentNotes).values({
    id: rowId,
    incidentId,
    authorId: ctx.user.id,
    authorRole: ctx.user.role,
    note,
  });

  return NextResponse.json({ status: 'dibuat', note_id: rowId });
});
