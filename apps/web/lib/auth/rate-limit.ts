import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { pinFailAttempts, settings, users } from '../../drizzle/schema';

/**
 * Catat percobaan PIN salah (BR-29).
 * Kunci akun jika `count >= pin_max_attempts` (default 5) selama `pin_lock_minutes` (default 15 min).
 */
export async function recordFailedAttempt(
  tx: typeof db,
  userId: string
): Promise<{ locked: boolean; lockedUntil?: Date; attemptsLeft: number }> {
  // Ambil setting pin_max_attempts & pin_lock_minutes
  const settingsRows = await tx
    .select()
    .from(settings)
    .where(sql`${settings.key} IN ('pin_max_attempts', 'pin_lock_minutes')`);

  const maxAttempts = parseInt(
    settingsRows.find((s) => s.key === 'pin_max_attempts')?.value ?? '5',
    10
  );
  const lockMinutes = parseInt(
    settingsRows.find((s) => s.key === 'pin_lock_minutes')?.value ?? '15',
    10
  );

  // Upsert pin_fail_attempts
  const [attempt] = await tx
    .insert(pinFailAttempts)
    .values({
      userId,
      count: 1,
      lastAttemptAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pinFailAttempts.userId,
      set: {
        count: sql`${pinFailAttempts.count} + 1`,
        lastAttemptAt: new Date(),
      },
    })
    .returning();

  const attemptsLeft = Math.max(0, maxAttempts - attempt.count);

  if (attempt.count >= maxAttempts) {
    const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);

    // Kunci user
    await tx
      .update(users)
      .set({ lockedUntil })
      .where(eq(users.id, userId));

    return { locked: true, lockedUntil, attemptsLeft: 0 };
  }

  return { locked: false, attemptsLeft };
}

/**
 * Reset percobaan gagal saat login berhasil.
 */
export async function resetFailedAttempts(
  tx: typeof db,
  userId: string
): Promise<void> {
  await tx
    .delete(pinFailAttempts)
    .where(eq(pinFailAttempts.userId, userId));
}
