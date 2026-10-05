import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { requireRole, withAuth } from '../../../../../../lib/auth/middleware';
import { db } from '../../../../../../lib/db';
import {
  shiftDefinitions,
  sopCategories,
  checklistPoints,
  handoverFields,
  branches,
} from '../../../../../../drizzle/schema';

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  // /api/admin/shifts/[id]/preview -> shiftId is at length - 2
  const shiftId = pathParts[pathParts.length - 2];

  const [shift] = await db
    .select({
      id: shiftDefinitions.id,
      name: shiftDefinitions.name,
      startTime: shiftDefinitions.startTime,
      endTime: shiftDefinitions.endTime,
      crossesMidnight: shiftDefinitions.crossesMidnight,
      isActive: shiftDefinitions.isActive,
      branchId: shiftDefinitions.branchId,
      branchName: branches.name,
    })
    .from(shiftDefinitions)
    .innerJoin(branches, eq(shiftDefinitions.branchId, branches.id))
    .where(eq(shiftDefinitions.id, shiftId))
    .limit(1);

  if (!shift) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  // Ambil handover fields
  const hFields = await db
    .select()
    .from(handoverFields)
    .where(eq(handoverFields.shiftDefinitionId, shiftId))
    .orderBy(handoverFields.sortOrder);

  // Ambil categories & points
  const categories = await db
    .select()
    .from(sopCategories)
    .where(eq(sopCategories.shiftDefinitionId, shiftId))
    .orderBy(sopCategories.sortOrder, desc(sopCategories.createdAt));

  const categoriesWithPoints = [];

  for (const cat of categories) {
    const points = await db
      .select()
      .from(checklistPoints)
      .where(eq(checklistPoints.sopCategoryId, cat.id))
      .orderBy(checklistPoints.sortOrder, desc(checklistPoints.createdAt));

    categoriesWithPoints.push({
      ...cat,
      points,
    });
  }

  return NextResponse.json({
    shift,
    handoverFields: hFields,
    categories: categoriesWithPoints,
  });
});
