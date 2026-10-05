import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { createUserSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../lib/auth/middleware';
import { hashPin } from '../../../../lib/auth/pin';
import { db } from '../../../../lib/db';
import { users, userBranchAccess, branches } from '../../../../drizzle/schema';
import { appendAuditLog } from '../../../../lib/db/audit';

export const GET = withAuth(async (_req, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      mustChangePin: users.mustChangePin,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      pinChangedAt: users.pinChangedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  // Ambil akses cabang per user
  const accessRows = await db
    .select({
      userId: userBranchAccess.userId,
      branchId: userBranchAccess.branchId,
      branchName: branches.name,
    })
    .from(userBranchAccess)
    .innerJoin(branches, eq(userBranchAccess.branchId, branches.id))
    .where(eq(userBranchAccess.isActive, true));

  const accessMap = new Map<string, { id: string; name: string }[]>();
  accessRows.forEach((row) => {
    if (!accessMap.has(row.userId)) {
      accessMap.set(row.userId, []);
    }
    accessMap.get(row.userId)!.push({ id: row.branchId, name: row.branchName });
  });

  const usersWithAccess = userList.map((u) => ({
    ...u,
    branches: accessMap.get(u.id) || [],
  }));

  return NextResponse.json({ users: usersWithAccess });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const parseResult = createUserSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, username, initialPin, role, branchIds } = parseResult.data;

    // Cek username unik
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: `Username '${username}' sudah digunakan.` },
        { status: 400 }
      );
    }

    const newUserId = ulid();
    const pinHash = await hashPin(initialPin);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: newUserId,
        name,
        username,
        pinHash,
        role,
        isActive: true,
        mustChangePin: true,
      });

      // Tambahkan akses cabang
      for (const branchId of branchIds) {
        await tx.insert(userBranchAccess).values({
          id: ulid(),
          userId: newUserId,
          branchId,
          grantedBy: ctx.user.id,
          isActive: true,
        });
      }

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'create_user',
        objectType: 'user',
        objectId: newUserId,
        after: { name, username, role, branchIds },
      });
    });

    return NextResponse.json({
      message: 'User berhasil dibuat',
      userId: newUserId,
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat membuat user' },
      { status: 500 }
    );
  }
});
