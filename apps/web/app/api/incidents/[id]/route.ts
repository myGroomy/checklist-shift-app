import { and, asc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { requireBranchAccess, withAuth } from '../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../lib/auth/session';
import {
  branches,
  incidentCategories,
  incidentNotes,
  incidents,
  photos,
  users,
} from '../../../../drizzle/schema';

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const incidentId = new URL(req.url).pathname.split('/').at(-1) ?? '';
  const [incident] = await db
    .select({
      id: incidents.id,
      branchId: incidents.branchId,
      branchName: branches.name,
      shiftInstanceId: incidents.shiftInstanceId,
      categoryName: incidentCategories.name,
      description: incidents.description,
      occurredAt: incidents.occurredAt,
      reportedAt: incidents.reportedAt,
      reportedByName: users.name,
      status: incidents.status,
      severity: incidents.severity,
    })
    .from(incidents)
    .innerJoin(branches, eq(incidents.branchId, branches.id))
    .innerJoin(incidentCategories, eq(incidents.categoryId, incidentCategories.id))
    .innerJoin(users, eq(incidents.reportedBy, users.id))
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) return NextResponse.json({ error: 'Incident tidak ditemukan' }, { status: 404 });
  const branchAccessError = requireBranchAccess(ctx, incident.branchId);
  if (branchAccessError) return branchAccessError;

  const [notes, photoRows] = await Promise.all([
    db
      .select({
        id: incidentNotes.id,
        note: incidentNotes.note,
        authorName: users.name,
        authorRole: incidentNotes.authorRole,
        createdAt: incidentNotes.createdAt,
      })
      .from(incidentNotes)
      .innerJoin(users, eq(incidentNotes.authorId, users.id))
      .where(eq(incidentNotes.incidentId, incidentId))
      .orderBy(asc(incidentNotes.createdAt)),
    db
      .select({
        id: photos.id,
        uploadedAt: photos.uploadedAt,
        status: photos.status,
      })
      .from(photos)
      .where(and(eq(photos.ownerType, 'incident'), eq(photos.ownerId, incidentId))),
  ]);

  return NextResponse.json({
    incident: {
      ...incident,
      occurredAt: incident.occurredAt.toISOString(),
      reportedAt: incident.reportedAt.toISOString(),
    },
    notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
    photos: photoRows.map((photo) => ({
      ...photo,
      uploadedAt: photo.uploadedAt?.toISOString() ?? null,
    })),
  });
});
