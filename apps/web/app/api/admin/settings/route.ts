import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { updateSettingsSchema } from '@checklist-shift/shared';
import { requireRole, withAuth } from '../../../../lib/auth/middleware';
import { db } from '../../../../lib/db';
import { settings } from '../../../../drizzle/schema';
import { appendAuditLog } from '../../../../lib/db/audit';

export const GET = withAuth(async (_req, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  const allSettings = await db
    .select()
    .from(settings)
    .orderBy(settings.key);

  return NextResponse.json({ settings: allSettings });
});

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const roleErr = requireRole(ctx, 'admin');
  if (roleErr) return roleErr;

  try {
    const body = await req.json();
    const parseResult = updateSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { settings: newSettings } = parseResult.data;

    // Validasi format value terhadap value_type kolom (Fase 3a)
    for (const item of newSettings) {
      const [existing] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, item.key))
        .limit(1);

      if (!existing) continue; // key tidak dikenal -> dilewati (tidak di-insert)

      const invalid =
        (existing.valueType === 'int' && !/^-?\d+$/.test(item.value)) ||
        (existing.valueType === 'bool' && !['TRUE', 'FALSE'].includes(item.value));

      if (invalid) {
        return NextResponse.json(
          {
            error: `Nilai untuk '${item.key}' harus bertipe ${existing.valueType} (${existing.valueType === 'int' ? 'angka bulat' : 'TRUE/FALSE'}).`,
          },
          { status: 400 }
        );
      }
    }

    await db.transaction(async (tx) => {
      for (const item of newSettings) {
        const [existing] = await tx
          .select()
          .from(settings)
          .where(eq(settings.key, item.key))
          .limit(1);

        if (existing) {
          await tx
            .update(settings)
            .set({
              value: item.value,
              updatedAt: new Date(),
              updatedBy: ctx.user.id,
            })
            .where(eq(settings.key, item.key));

          await appendAuditLog(tx, {
            actorId: ctx.user.id,
            action: 'update_setting',
            objectType: 'setting',
            objectId: item.key,
            before: { value: existing.value },
            after: { value: item.value },
          });
        }
      }
    });

    return NextResponse.json({ message: 'Pengaturan berhasil diperbarui' });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat memperbarui pengaturan' },
      { status: 500 }
    );
  }
});
