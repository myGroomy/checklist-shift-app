import { and, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { db } from '../../../../../lib/db';
import type { Snapshot } from '../../../../../lib/db/snapshot';
import { getServerTime } from '../../../../../lib/db/server-time';
import { computeTiming } from '../../../../../lib/shift/time';
import { requireBranchAccess, withAuth } from '../../../../../lib/auth/middleware';
import type { AuthContext } from '../../../../../lib/auth/session';
import {
  branches,
  entries,
  entryLogs,
  participants,
  shiftInstances,
  users,
} from '../../../../../drizzle/schema';

type EntryAction = 'selesai' | 'batal' | 'skip' | 'ubah_nilai';

interface EntryBody {
  client_action_id?: string;
  point_ref?: string;
  action?: EntryAction;
  value?: string | number | boolean | null;
  skip_reason?: string;
  client_at?: string;
}

interface Validation {
  value: string | null;
  outOfRange: boolean;
}

const MAX_TEXT_LENGTH = 2000;

/**
 * Validasi & normalisasi nilai sesuai tipe input pada snapshot.
 * Untuk tipe angka, nilai di luar rentang TIDAK ditolak: dicatat out_of_range.
 */
function validateValue(
  inputType: string,
  raw: EntryBody['value'],
  min: number | null,
  max: number | null
): Validation | { error: string } {
  if (inputType === 'centang' || inputType === 'ok_tidak_ok') {
    if (typeof raw === 'boolean') return { value: raw ? 'true' : 'false', outOfRange: false };
    if (raw === 'true' || raw === 'false') return { value: raw, outOfRange: false };
    if (inputType === 'ok_tidak_ok' && (raw === 'ya' || raw === 'tidak')) {
      return { value: raw, outOfRange: false };
    }
    return { error: 'Nilai harus true/false' };
  }

  if (inputType === 'teks') {
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { error: 'Nilai teks wajib diisi' };
    }
    const text = raw.trim();
    if (text.length > MAX_TEXT_LENGTH) {
      return { error: `Nilai teks maksimal ${MAX_TEXT_LENGTH} karakter` };
    }
    return { value: text, outOfRange: false };
  }

  if (inputType === 'angka') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (raw === null || raw === undefined || raw === '' || Number.isNaN(num)) {
      return { error: 'Nilai harus berupa angka' };
    }
    const outOfRange = (min !== null && num < min) || (max !== null && num > max);
    return { value: String(num), outOfRange };
  }

  if (inputType === 'foto') {
    // Foto dikirim lewat /api/photos/upload lalu dirujuk lewat id.
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { error: 'Nilai foto harus berupa id foto' };
    }
    return { value: raw.trim(), outOfRange: false };
  }

  return { error: `Tipe input tidak dikenal: ${inputType}` };
}

/**
 * Aksi checklist (Fase 4, BR-12).
 * Satu aksi pengguna = satu transaction:
 * idempotency -> validasi shift berjalan -> SELECT FOR UPDATE entry ->
 * proses BR-12 -> UPSERT entries + INSERT entry_logs + upsert participants.
 */
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const shiftInstanceId = new URL(req.url).pathname.split('/').slice(-2)[0];

  let body: EntryBody;
  try {
    body = (await req.json()) as EntryBody;
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON' }, { status: 400 });
  }

  const clientActionId = body.client_action_id;
  const pointRef = body.point_ref;
  const action = body.action;

  if (!clientActionId || !pointRef || !action) {
    return NextResponse.json(
      { error: 'client_action_id, point_ref, dan action wajib diisi' },
      { status: 400 }
    );
  }
  if (!['selesai', 'batal', 'skip', 'ubah_nilai'].includes(action)) {
    return NextResponse.json({ error: 'action tidak valid' }, { status: 400 });
  }

  // Idempotency: aksi yang sama diulang tidak boleh menggandakan efek
  const [duplicateLog] = await db
    .select({
      entryId: entryLogs.entryId,
      outcome: entryLogs.outcome,
      newState: entryLogs.newState,
      value: entryLogs.value,
    })
    .from(entryLogs)
    .where(eq(entryLogs.clientActionId, clientActionId))
    .limit(1);
  if (duplicateLog) {
    return NextResponse.json({
      status: 'duplikat',
      outcome: duplicateLog.outcome,
      entry_id: duplicateLog.entryId,
      state: duplicateLog.newState,
      value: duplicateLog.value,
    });
  }

  const [instance] = await db
    .select()
    .from(shiftInstances)
    .where(eq(shiftInstances.id, shiftInstanceId))
    .limit(1);
  if (!instance) {
    return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
  }

  const branchAccessError = requireBranchAccess(ctx, instance.branchId);
  if (branchAccessError) return branchAccessError;

  // Setelah ditutup, checklist tidak bisa diubah lewat API
  if (instance.status !== 'berjalan') {
    return NextResponse.json(
      { error: 'Shift sudah ditutup. Checklist tidak dapat diubah.', code: 'SHIFT_CLOSED' },
      { status: 409 }
    );
  }

  const [branch] = await db
    .select({ timezone: branches.timezone })
    .from(branches)
    .where(eq(branches.id, instance.branchId))
    .limit(1);
  const timezone = branch?.timezone ?? 'Asia/Jakarta';

  const snapshot = instance.templateSnapshot as unknown as Snapshot;
  const point = snapshot.categories
    .flatMap((c) => c.points)
    .find((p) => p.point_ref === pointRef);
  if (!point) {
    return NextResponse.json(
      { error: 'Item checklist tidak ada pada shift ini' },
      { status: 404 }
    );
  }

  if (action === 'skip' && (body.skip_reason ?? '').trim().length < 3) {
    return NextResponse.json(
      { error: 'Alasan skip wajib diisi (minimal 3 karakter)' },
      { status: 400 }
    );
  }

  let value: string | null = null;
  let outOfRange = false;
  if (action === 'selesai' || action === 'ubah_nilai') {
    const validated = validateValue(
      point.input_type,
      body.value,
      point.number_min,
      point.number_max
    );
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    value = validated.value;
    outOfRange = validated.outOfRange;
  }

  const now = getServerTime();
  const toleranceDefault = snapshot.settings.tolerance_default_minutes;

  try {
    const result = await db.transaction(async (tx) => {
      // Kunci per item:_entry masih belum ada, FOR UPDATE tidak mengunci apa pun,
      // jadi dua petugas bisa saling menyalip. Advisory lock menutup celah itu.
      const pointLockKey = `entry:${shiftInstanceId}:${pointRef}`;
      const pointLock = await tx.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtext(${pointLockKey})) AS acquired`
      );
      if (!(pointLock[0] as { acquired: boolean }).acquired) {
        return { kind: 'terkunci' as const };
      }

      // BR-12: kunci baris entry supaya hanya satu aksi yang menang
      const [existing] = await tx
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.shiftInstanceId, shiftInstanceId),
            eq(entries.pointRef, pointRef)
          )
        )
        .for('update')
        .limit(1);

      const prevState = existing?.state ?? 'belum';

      // BR-12: aksi pertama pada item diterima; ACTIONS correction
      // `ubah_nilai` hanya boleh oleh petugas yang sama (koreksi nilai sendiri).
      const isOwnCorrection = action === 'ubah_nilai' && existing?.completedBy === ctx.user.id;

      if (!isOwnCorrection && action !== 'batal' && existing && existing.state !== 'belum') {
        // Kalah balapan: item sudah diselesaikan petugas lain
        let winnerName: string | null = null;
        if (existing.completedBy) {
          const [winner] = await tx
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, existing.completedBy))
            .limit(1);
          winnerName = winner?.name ?? null;
        }
        await tx.insert(entryLogs).values({
          id: ulid(),
          shiftInstanceId,
          entryId: existing.id,
          pointRef,
          action,
          outcome: 'ditolak_kalah',
          userId: ctx.user.id,
          winnerUserId: existing.completedBy,
          prevState: existing.state,
          newState: existing.state,
          value,
          clientActionId,
          clientAt: body.client_at ? new Date(body.client_at) : null,
          at: now,
        });
        return {
          kind: 'kalah' as const,
          winnerName,
          winnerUserId: existing.completedBy,
          state: existing.state,
        };
      }

      const newState = action === 'skip' ? 'skip' : action === 'batal' ? 'belum' : 'selesai';
      const skipReason = newState === 'skip' ? (body.skip_reason ?? '').trim() : null;
      const timing =
        newState === 'selesai'
          ? computeTiming(
              now,
              timezone,
              point.target_time,
              point.tolerance_minutes,
              toleranceDefault
            )
          : { timingLabel: null, timingDeltaMinutes: null };

      const entryId = existing?.id ?? ulid();
      if (existing) {
        await tx
          .update(entries)
          .set({
            state: newState,
            value: newState === 'belum' ? null : value,
            outOfRange: newState === 'belum' ? false : outOfRange,
            completedBy: newState === 'belum' ? null : ctx.user.id,
            completedAt: newState === 'belum' ? null : now,
            timingLabel: timing.timingLabel,
            timingDeltaMinutes: timing.timingDeltaMinutes,
            skipReason,
            updatedAt: now,
            version: (existing.version ?? 1) + 1,
          })
          .where(eq(entries.id, entryId));
      } else {
        await tx.insert(entries).values({
          id: entryId,
          shiftInstanceId,
          pointRef,
          state: newState,
          value: newState === 'belum' ? null : value,
          outOfRange: newState === 'belum' ? false : outOfRange,
          completedBy: newState === 'belum' ? null : ctx.user.id,
          completedAt: newState === 'belum' ? null : now,
          timingLabel: timing.timingLabel,
          timingDeltaMinutes: timing.timingDeltaMinutes,
          skipReason,
        });
      }

      await tx.insert(entryLogs).values({
        id: ulid(),
        shiftInstanceId,
        entryId,
        pointRef,
        action,
        outcome: 'diterima',
        userId: ctx.user.id,
        prevState,
        newState,
        value,
        note: skipReason,
        clientActionId,
        clientAt: body.client_at ? new Date(body.client_at) : null,
        at: now,
      });

      // Peserta baru ikut tercatat lewat aksi pertamanya
      const [alreadyParticipant] = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            eq(participants.shiftInstanceId, shiftInstanceId),
            eq(participants.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!alreadyParticipant) {
        const firstActionType =
          action === 'skip' ? 'skip' : point.input_type === 'centang' ? 'centang' : 'isi';
        await tx.insert(participants).values({
          id: ulid(),
          shiftInstanceId,
          userId: ctx.user.id,
          firstActionAt: now,
          firstActionType,
        });
      }

      return {
        kind: 'diterima' as const,
        entryId,
        state: newState,
        value: newState === 'belum' ? null : value,
        outOfRange: newState === 'belum' ? false : outOfRange,
        skipReason,
        timingLabel: timing.timingLabel,
        timingDeltaMinutes: timing.timingDeltaMinutes,
      };
    });

    if (result.kind === 'terkunci') {
      return NextResponse.json(
        {
          error: 'Item sedang dikerjakan petugas lain. Coba lagi sebentar.',
          code: 'ITEM_BUSY',
        },
        { status: 409 }
      );
    }

    if (result.kind === 'kalah') {
      return NextResponse.json(
        {
          error: `Sudah diselesaikan oleh ${result.winnerName ?? 'petugas lain'}`,
          code: 'BR12_CONFLICT',
          winner_user_id: result.winnerUserId,
          state: result.state,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ status: 'diterima', entry: result });
  } catch (error) {
    // Bentrok unique index: bisa karena client_action_id sama (idempotency race)
    // atau dua aksi paralel pada item yang sama. Bedakan keduanya.
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      const [logExists] = await db
        .select({ id: entryLogs.id })
        .from(entryLogs)
        .where(eq(entryLogs.clientActionId, clientActionId))
        .limit(1);
      if (logExists) {
        return NextResponse.json({ status: 'duplikat' });
      }
      const [current] = await db
        .select({ completedBy: entries.completedBy, state: entries.state })
        .from(entries)
        .where(
          and(
            eq(entries.shiftInstanceId, shiftInstanceId),
            eq(entries.pointRef, pointRef)
          )
        )
        .limit(1);
      if (current && current.state !== 'belum') {
        let winnerName: string | null = null;
        if (current.completedBy) {
          const [winner] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, current.completedBy))
            .limit(1);
          winnerName = winner?.name ?? null;
        }
        return NextResponse.json(
          {
            error: `Sudah diselesaikan oleh ${winnerName ?? 'petugas lain'}`,
            code: 'BR12_CONFLICT',
            winner_user_id: current.completedBy,
            state: current.state,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ status: 'duplikat' });
    }
    console.error('Entry action error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server saat menyimpan aksi' },
      { status: 500 }
    );
  }
});