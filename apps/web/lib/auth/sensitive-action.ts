import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../../drizzle/schema';
import { verifyPin } from './pin';

/**
 * Memeriksa PIN admin untuk aksi sensitif (BR-27 / AGENTS.md §6).
 * Return null jika PIN valid, return string pesan kesalahan jika tidak valid.
 */
export async function verifyAdminPin(
  adminUserId: string,
  pin: string
): Promise<string | null> {
  const [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, adminUserId))
    .limit(1);

  if (!adminUser) {
    return 'User admin tidak ditemukan';
  }

  const isValid = await verifyPin(pin, adminUser.pinHash);
  if (!isValid) {
    return 'PIN konfirmasi admin salah';
  }

  return null;
}
