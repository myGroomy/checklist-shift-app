import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@checklist-shift/shared';
import { db } from '../../../../lib/db';
import { users } from '../../../../drizzle/schema';
import { verifyPin } from '../../../../lib/auth/pin';
import { recordFailedAttempt, resetFailedAttempts } from '../../../../lib/auth/rate-limit';
import { createSession, setSessionCookie } from '../../../../lib/auth/session';
import { appendAuditLog } from '../../../../lib/db/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { username, pin } = parseResult.data;

    // Cari user by username
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (userRows.length === 0) {
      return NextResponse.json(
        { error: 'Username atau PIN salah' },
        { status: 401 }
      );
    }

    const user = userRows[0];

    // Cek apakah akun aktif
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Akun Anda nonaktif. Hubungi Admin.' },
        { status: 403 }
      );
    }

    // Cek apakah akun sedang terkunci (BR-29)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
      );
      return NextResponse.json(
        {
          error: `Akun terkunci karena salah PIN 5 kali. Coba lagi dalam ${remainingMinutes} menit atau hubungi Admin.`,
          lockedUntil: user.lockedUntil,
        },
        { status: 423 }
      );
    }

    // Verifikasi PIN
    const isValidPin = await verifyPin(pin, user.pinHash);

    if (!isValidPin) {
      // Catat percobaan gagal
      const failResult = await db.transaction(async (tx) => {
        const res = await recordFailedAttempt(tx, user.id);
        await appendAuditLog(tx, {
          actorId: user.id,
          action: 'login_failed',
          objectType: 'user',
          objectId: user.id,
          reason: res.locked ? 'Account locked due to max failed attempts' : 'Wrong PIN',
        });
        return res;
      });

      if (failResult.locked) {
        return NextResponse.json(
          {
            error: 'PIN salah 5 kali. Akun Anda dikunci selama 15 menit.',
            lockedUntil: failResult.lockedUntil,
          },
          { status: 423 }
        );
      }

      return NextResponse.json(
        {
          error: `PIN salah. Sisa percobaan: ${failResult.attemptsLeft}`,
          attemptsLeft: failResult.attemptsLeft,
        },
        { status: 401 }
      );
    }

    // PIN benar -> Proses login atomik
    const deviceInfo = req.headers.get('user-agent') ?? undefined;

    const { token, expiresAt } = await db.transaction(async (tx) => {
      // Reset fail count
      await resetFailedAttempts(tx, user.id);

      // Update last login & clear locked_until jika ada
      await tx
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lockedUntil: null,
        })
        .where(eq(users.id, user.id));

      // Buat sesi
      const sessionResult = await createSession(tx, user.id, deviceInfo);

      // Audit log
      await appendAuditLog(tx, {
        actorId: user.id,
        action: 'login_success',
        objectType: 'session',
        objectId: sessionResult.sessionId,
      });

      return sessionResult;
    });

    // Set cookie
    setSessionCookie(token, expiresAt);

    return NextResponse.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        mustChangePin: user.mustChangePin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat login' },
      { status: 500 }
    );
  }
}
