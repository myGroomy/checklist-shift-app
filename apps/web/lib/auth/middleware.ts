import { NextRequest, NextResponse } from 'next/server';
import { AuthContext, getSessionTokenFromCookie, validateSessionToken } from './session';

export type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthContext
) => Promise<NextResponse>;

/**
 * Higher-order function untuk melindungi API Routes.
 * - Memeriksa cookie session_token & validasi di DB.
 * - Memeriksa CSRF header `X-Requested-With: fetch` untuk request mutasi (POST, PUT, DELETE, PATCH).
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // CSRF Check pada request mutasi (non-GET, non-HEAD)
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const csrfHeader = req.headers.get('x-requested-with');
      if (!csrfHeader || csrfHeader.toLowerCase() !== 'fetch') {
        return NextResponse.json(
          { error: 'Header X-Requested-With: fetch wajib untuk request mutasi' },
          { status: 400 }
        );
      }
    }

    const token = getSessionTokenFromCookie();
    if (!token) {
      return NextResponse.json(
        { error: 'Belum terotentikasi. Sesi tidak ditemukan.' },
        { status: 401 }
      );
    }

    const authCtx = await validateSessionToken(token);
    if (!authCtx) {
      return NextResponse.json(
        { error: 'Sesi tidak valid atau telah kadaluwarsa.' },
        { status: 401 }
      );
    }

    // Paksa ganti PIN (Fase 2): hanya endpoint auth berikut yang boleh diakses
    if (authCtx.user.mustChangePin) {
      const path = req.nextUrl.pathname;
      const allowed = [
        '/api/auth/change-pin',
        '/api/auth/logout',
        '/api/auth/logout-all',
        '/api/auth/me',
      ].some((p) => path.startsWith(p));
      if (!allowed) {
        return NextResponse.json(
          { error: 'Anda wajib mengubah PIN terlebih dahulu.', code: 'MUST_CHANGE_PIN' },
          { status: 403 }
        );
      }
    }

    return handler(req, authCtx);
  };
}

/**
 * Validasi role user (misal: 'admin').
 * Return null jika sah, return NextResponse (403) jika ditolak.
 */
export function requireRole(
  authCtx: AuthContext,
  requiredRole: 'admin' | 'petugas'
): NextResponse | null {
  if (authCtx.user.role !== requiredRole && authCtx.user.role !== 'admin') {
    return NextResponse.json(
      { error: `Akses ditolak. Peran ${requiredRole} diperlukan.` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Validasi akses cabang.
 * Return null jika sah, return NextResponse (403) jika ditolak.
 */
export function requireBranchAccess(
  authCtx: AuthContext,
  branchId: string
): NextResponse | null {
  if (!authCtx.branchIds.includes(branchId)) {
    return NextResponse.json(
      { error: 'Akses ditolak. Anda tidak memiliki akses ke cabang ini.' },
      { status: 403 }
    );
  }
  return null;
}
