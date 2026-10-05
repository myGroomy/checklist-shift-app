import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Path publik yang tidak memerlukan autentikasi
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',
  '/api/public',
  '/r',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/icons',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cek apakah path publik
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const token = req.cookies.get('session_token')?.value;

  // Jika mencoba akses path publik tanpa/dengan token
  if (isPublic) {
    // Jika di /login tapi sudah punya token, arahkan ke home
    if (pathname === '/login' && token) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // Path terproteksi: jika tidak ada token, redirect ke /login
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
