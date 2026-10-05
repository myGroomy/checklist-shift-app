import { NextRequest, NextResponse } from 'next/server';
import { eq, and, count } from 'drizzle-orm';
import { ulid } from 'ulid';
import { updateUserSchema, sensitiveActionSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../../lib/auth/middleware';
import { verifyAdminPin } from '../../../../../lib/auth/sensitive-action';
import { db } from '../../../../../lib/db';
import { users, userBranchAccess } from '../../../../../drizzle/schema';
import { appendAuditLog } from '../../../../../lib/db/audit';

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const targetUserId = pathParts[pathParts.length - 1];

  try {
    const body = await req.json();
    const parseResult = updateUserSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const { name, role, branchIds, isActive } = parseResult.data;

    // Aksi sensitif (ubah peran / nonaktifkan) wajib alasan + PIN admin (AGENTS §6)
    const isSensitiveChange = role !== undefined || isActive !== undefined || branchIds !== undefined;
    const sensitiveBody = sensitiveActionSchema.safeParse(body);
    if (isSensitiveChange && !sensitiveBody.success) {
      return NextResponse.json(
        {
          error:
            'Ubah peran/nonaktifkan akun wajib menyertakan alasan dan PIN konfirmasi admin',
          details: sensitiveBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    let sensitiveReason: string | undefined;
    if (isSensitiveChange && sensitiveBody.success) {
      const pinErr = await verifyAdminPin(ctx.user.id, sensitiveBody.data.pin);
      if (pinErr) {
        return NextResponse.json({ error: pinErr }, { status: 403 });
      }
      sensitiveReason = sensitiveBody.data.reason;
    }

    // Protection rule: Peringatan Admin Terakhir (AGENTS.md §6 & PRD)
    // Jangan izinkan nonaktifkan atau menurunkan peran jika user adalah admin aktif terakhir.
    if (existing.role === 'admin' && (isActive === false || role === 'petugas')) {
      const [adminCountRow] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

      if (adminCountRow.value <= 1) {
        return NextResponse.json(
          {
            error:
              'Operasi ditolak. Sistem harus memiliki setidaknya 1 admin aktif.',
          },
          { status: 400 }
        );
      }
    }

    await db.transaction(async (tx) => {
      // Update data user utama jika ada
      const userUpdates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) userUpdates.name = name;
      if (role !== undefined) userUpdates.role = role;
      if (isActive !== undefined) userUpdates.isActive = isActive;

      await tx.update(users).set(userUpdates).where(eq(users.id, targetUserId));

      // Sync akses cabang jika branchIds dikirim
      if (branchIds !== undefined) {
        // Nonaktifkan akses cabang lama
        await tx
          .update(userBranchAccess)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(userBranchAccess.userId, targetUserId));

        // Tambah/aktifkan akses cabang baru
        for (const bId of branchIds) {
          const [existingAcc] = await tx
            .select()
            .from(userBranchAccess)
            .where(
              and(
                eq(userBranchAccess.userId, targetUserId),
                eq(userBranchAccess.branchId, bId)
              )
            )
            .limit(1);

          if (existingAcc) {
            await tx
              .update(userBranchAccess)
              .set({ isActive: true, updatedAt: new Date() })
              .where(eq(userBranchAccess.id, existingAcc.id));
          } else {
            await tx.insert(userBranchAccess).values({
              id: ulid(),
              userId: targetUserId,
              branchId: bId,
              grantedBy: ctx.user.id,
              isActive: true,
            });
          }
        }
      }

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'update_user',
        objectType: 'user',
        objectId: targetUserId,
        reason: sensitiveReason,
        before: { name: existing.name, role: existing.role, isActive: existing.isActive },
        after: { name, role, isActive, branchIds },
      });
    });

    return NextResponse.json({ message: 'User berhasil diperbarui' });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui user' },
      { status: 500 }
    );
  }
});
