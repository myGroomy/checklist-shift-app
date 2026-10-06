import { redirect } from 'next/navigation';
import {
  AuthContext,
  getSessionTokenFromCookie,
  validateSessionToken,
} from './session';

/**
 * Guard untuk halaman /admin (server component).
 * Redirect: tanpa sesi -> /login; bukan admin -> /.
 */
export async function requireAdmin(): Promise<AuthContext> {
  const token = getSessionTokenFromCookie();
  if (!token) redirect('/login');

  const ctx = await validateSessionToken(token);
  if (!ctx) redirect('/login');

  if (ctx.user.role !== 'admin') redirect('/');

  return ctx;
}
