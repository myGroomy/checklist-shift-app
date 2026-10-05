import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { changePinSchema } from '@checklist-shift/shared';
import { withAuth } from '../../../../lib/auth/middleware';
import { hashPin, isWeakPin, verifyPin } from '../../../../lib/auth/pin';
import { db } from '../../../../lib/db';
import { settings, users } from '../../../../drizzle/schema';
import { appendAuditLog } from '../../../../lib/db/audit';

export const POST = withAuth(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const parseResult = changePinSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { oldPin, newPin } = parseResult.data;

    // Fetch user from DB to get current pinHash
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 444 });
    }

    // Verify old PIN
    const isValidOldPin = await verifyPin(oldPin, user.pinHash);
    if (!isValidOldPin) {
      return NextResponse.json(
        { error: 'PIN lama salah' },
        { status: 400 }
      );
    }

    // Check setting pin_block_weak
    const [weakPinSetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'pin_block_weak'))
      .limit(1);
    const blockWeak = weakPinSetting ? weakPinSetting.value === 'TRUE' : true;

    if (blockWeak && isWeakPin(newPin)) {
      return NextResponse.json(
        {
          error:
            'PIN baru terlalu lemah. Gunakan kombinasi 6 angka yang tidak urut, tidak berulang, dan tidak sama.',
        },
        { status: 400 }
      );
    }

    // Hash new PIN
    const newPinHash = await hashPin(newPin);

    // Update user in transaction + audit log
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          pinHash: newPinHash,
          mustChangePin: false,
          pinChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      await appendAuditLog(tx, {
        actorId: ctx.user.id,
        action: 'change_pin',
        objectType: 'user',
        objectId: ctx.user.id,
      });
    });

    return NextResponse.json({
      message: 'PIN berhasil diubah',
    });
  } catch (error) {
    console.error('Change PIN error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat mengubah PIN' },
      { status: 500 }
    );
  }
});
