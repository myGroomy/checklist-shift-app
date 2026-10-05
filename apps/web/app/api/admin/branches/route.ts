import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { branchSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../lib/auth/middleware';
import { isValidTimeZone } from '../../../../lib/valid-timezone';
import { db } from '../../../../lib/db';
import { branches } from '../../../../drizzle/schema';
import { appendAuditLog } from '../../../../lib/db/audit';

export const GET = withAuth(async (_req, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const branchList = await db
    .select()
    .from(branches)
    .orderBy(desc(branches.createdAt));

  return NextResponse.json({ branches: branchList });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const parseResult = branchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, code, address, timezone } = parseResult.data;

    if (!isValidTimeZone(timezone)) {
      return NextResponse.json(
        { error: `Timezone '${timezone}' bukan zona waktu IANA yang valid (misal: Asia/Jakarta).` },
        { status: 400 }
      );
    }

    // Cek duplikasi kode cabang
    const existingCode = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.code, code))
      .limit(1);

    if (existingCode.length > 0) {
      return NextResponse.json(
        { error: `Kode cabang '${code}' sudah digunakan.` },
        { status: 400 }
      );
    }

    const newBranchId = ulid();

    await db.transaction(async (tx) => {
      await tx.insert(branches).values({
        id: newBranchId,
        name,
        code,
        address: address ?? null,
        timezone,
        isActive: true,
      });

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_branch',
        objectType: 'branch',
        objectId: newBranchId,
        branchId: newBranchId,
        after: { name, code, address, timezone },
      });
    });

    return NextResponse.json({
      message: 'Cabang berhasil dibuat',
      branchId: newBranchId,
    });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat cabang' },
      { status: 500 }
    );
  }
});
