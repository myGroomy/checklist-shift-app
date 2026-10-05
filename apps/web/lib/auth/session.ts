import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { sessions, users, userBranchAccess, branches, settings } from '../../drizzle/schema';

const COOKIE_NAME = 'session_token';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET tidak dikonfigurasi di environment');
  }
  return secret;
}

// ============================================
// Simple JWT HS256 (Node stdlib - zero dependency)
// ============================================

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

export function signToken(payload: { userId: string; sessionId: string; exp: number }): string {
  const secret = getSessionSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payloadEncoded}`)
    .digest('base64url');
  return `${header}.${payloadEncoded}.${signature}`;
}

export function verifyToken(token: string): { userId: string; sessionId: string; exp: number } | null {
  try {
    const secret = getSessionSecret();
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
      return null; // Expired
    }

    return decodedPayload;
  } catch {
    return null;
  }
}

// ============================================
// Session Management
// ============================================

export interface AuthContext {
  user: {
    id: string;
    name: string;
    username: string;
    role: 'admin' | 'petugas';
    mustChangePin: boolean;
    isActive: boolean;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
  branchIds: string[]; // Cabang yang diizinkan untuk user
}

/**
 * Buat sesi baru di DB + token JWT.
 */
export async function createSession(
  tx: typeof db,
  userId: string,
  deviceInfo?: string
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  // Ambil setting session_days (default 30)
  const sessionDaysSetting = await tx
    .select()
    .from(settings)
    .where(eq(settings.key, 'session_days'))
    .limit(1);
  const sessionDays = sessionDaysSetting.length > 0
    ? parseInt(sessionDaysSetting[0].value, 10)
    : 30;

  const sessionId = ulid();
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  await tx.insert(sessions).values({
    id: sessionId,
    userId,
    deviceInfo: deviceInfo ?? null,
    expiresAt,
  });

  const token = signToken({
    userId,
    sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });

  return { token, expiresAt, sessionId };
}

/**
 * Validasi token sesi dari cookie dan return AuthContext.
 */
export async function validateSessionToken(token: string): Promise<AuthContext | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  // Query DB untuk pastikan session & user valid
  const sessionRows = await db
    .select({
      sessionId: sessions.id,
      sessionExpiresAt: sessions.expiresAt,
      sessionRevokedAt: sessions.revokedAt,
      userId: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      mustChangePin: users.mustChangePin,
      isActive: users.isActive,
      lockedUntil: users.lockedUntil,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, payload.sessionId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  if (sessionRows.length === 0) return null;
  const s = sessionRows[0];

  // Cek apakah akun sedang terkunci
  if (s.lockedUntil && s.lockedUntil > new Date()) return null;

  // Sub-query cabang yang dapat diakses user
  let branchIds: string[] = [];
  if (s.role === 'admin') {
    // Admin punya akses ke semua cabang aktif
    const allBranches = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.isActive, true));
    branchIds = allBranches.map((b) => b.id);
  } else {
    // Petugas hanya cabang yang diberikan akses
    const userAccess = await db
      .select({ branchId: userBranchAccess.branchId })
      .from(userBranchAccess)
      .where(
        and(
          eq(userBranchAccess.userId, s.userId),
          eq(userBranchAccess.isActive, true)
        )
      );
    branchIds = userAccess.map((a) => a.branchId);
  }

  return {
    user: {
      id: s.userId,
      name: s.name,
      username: s.username,
      role: s.role,
      mustChangePin: s.mustChangePin,
      isActive: s.isActive,
    },
    session: {
      id: s.sessionId,
      expiresAt: s.sessionExpiresAt,
    },
    branchIds,
  };
}

/**
 * Revoke satu sesi (logout).
 */
export async function revokeSession(tx: typeof db, sessionId: string): Promise<void> {
  await tx
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Revoke semua sesi user (logout-all atau paksa logout).
 */
export async function revokeAllUserSessions(tx: typeof db, userId: string): Promise<void> {
  await tx
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

// ============================================
// Cookie Helpers (Server Component / Route Handler)
// ============================================

export function setSessionCookie(token: string, expiresAt: Date): void {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(): void {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
}

export function getSessionTokenFromCookie(): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}
