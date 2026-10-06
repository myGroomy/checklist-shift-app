'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ulid } from 'ulid';
import { AlertCircle, ArrowLeft, Clock3, Loader2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChecklistPointControls } from '@/components/shift/checklist-point-controls';
import { ShiftCloseDialog } from '@/components/shift/shift-close-dialog';

type EntryState = 'belum' | 'selesai' | 'skip';
type InputType = 'centang' | 'foto' | 'teks' | 'angka' | 'ok_tidak_ok';

interface ProgressPoint {
  point_ref: string;
  title: string;
  instruction: string | null;
  input_type: InputType;
  is_required: boolean;
  target_time: string | null;
  number_min: number | null;
  number_max: number | null;
  sort_order: number;
  state: EntryState;
  value: string | null;
  out_of_range: boolean;
  skip_reason: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  timing_label: string | null;
  timing_delta_minutes: number | null;
}

interface ProgressCategory {
  id: string;
  name: string;
  sort_order: number;
  points: ProgressPoint[];
}

interface ShiftProgressResponse {
  shift: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    date: string;
    status: string;
    branch_timezone: string | null;
    pj_user_id: string;
  };
  progress: {
    total: number;
    selesai: number;
    skip: number;
    belum: number;
    wajib_selesai: number;
  };
  categories: ProgressCategory[];
  participants: Array<{
    user_id: string;
    name: string;
    is_pj: boolean;
    first_action_type: string;
    first_action_at: string;
    items_done: number;
  }>;
  handover_fields: Array<{
    id: string;
    label: string;
    field_type: string;
    options: string[] | null;
    is_required: boolean;
  }>;
  server_time: string;
}

function formatTime(value: string | null) {
  if (!value) return '-';
  return value.slice(0, 5);
}

function labelTiming(timing: string | null) {
  switch (timing) {
    case 'tepat_waktu':
      return 'Tepat waktu';
    case 'lebih_awal':
      return 'Lebih awal';
    case 'terlambat':
      return 'Terlambat';
    default:
      return 'Belum dihitung';
  }
}

export function ShiftChecklistClient({
  shiftId,
  userId,
}: {
  shiftId: string;
  userId: string;
}) {
  const [data, setData] = useState<ShiftProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPoint, setBusyPoint] = useState<string | null>(null);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/progress`, {
        next: { revalidate: 30 },
        headers: { 'X-Requested-With': 'fetch' },
      });
      if (!res.ok) {
        throw new Error('Gagal memuat progress shift');
      }
      const next = (await res.json()) as ShiftProgressResponse;
      setData(next);
    } catch {
      setNotice('Gagal memuat progress shift. Coba refresh halaman.');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadProgress();
    };
    const interval = window.setInterval(refresh, 20_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadProgress]);

  const totalDone = useMemo(() => data?.progress.selesai ?? 0, [data]);
  const totalSkip = useMemo(() => data?.progress.skip ?? 0, [data]);

  const submitEntry = async (point: ProgressPoint, action: 'selesai' | 'batal' | 'skip', rawValue?: string) => {
    setBusyPoint(point.point_ref);
    setNotice(null);
    try {
      const payload: Record<string, string | number | boolean | null> = {
        client_action_id: ulid(),
        point_ref: point.point_ref,
        action,
      };

      if (action === 'skip') {
        const reason = (rawValue ?? '').trim();
        if (reason.length < 3) {
          throw new Error('Alasan skip minimal 3 karakter.');
        }
        payload.skip_reason = reason;
      } else if (point.input_type === 'angka') {
        const numeric = Number(rawValue ?? '');
        if (Number.isNaN(numeric)) {
          throw new Error('Nilai angka tidak valid.');
        }
        payload.value = numeric;
      } else if (point.input_type === 'centang' || point.input_type === 'ok_tidak_ok') {
        payload.value = rawValue === 'true' || rawValue === 'ya' || rawValue === 'ok';
      } else if (point.input_type === 'teks') {
        payload.value = (rawValue ?? '').trim();
      } else {
        payload.value = rawValue ?? null;
      }

      const res = await fetch(`/api/shifts/${shiftId}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; status?: string; code?: string };
      if (!res.ok) {
        if (json.code === 'BR12_CONFLICT') {
          await loadProgress();
        }
        throw new Error(json.error || 'Tidak dapat menyimpan aksi checklist');
      }
      await loadProgress();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal menyimpan checklist');
    } finally {
      setBusyPoint(null);
    }
  };

  const markOnDuty = async () => {
    setNotice(null);
    try {
      const response = await fetch(`/api/shifts/${shiftId}/join?duty=1`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Gagal mencatat tugas.');
      await loadProgress();
      setNotice('Status saya bertugas sudah dicatat.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal mencatat tugas.');
    }
  };

  if (loading && !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat shift...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
          Shift tidak tersedia.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
        </div>
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-wide text-ink-muted">
          {data.shift.status}
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{data.shift.date}</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">{data.shift.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {formatTime(data.shift.start_time)} - {formatTime(data.shift.end_time)}
              {data.shift.branch_timezone ? ` • ${data.shift.branch_timezone}` : ''}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-canvas px-3 py-2 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{totalDone}</span> / {data.progress.total} selesai
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Progress</p>
          <p className="mt-2 text-2xl font-bold text-ink">{totalDone + totalSkip}/{data.progress.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Belum</p>
          <p className="mt-2 text-2xl font-bold text-ink">{data.progress.belum}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Peserta</p>
          <p className="mt-2 text-2xl font-bold text-ink">{data.participants.length}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <section className="space-y-4">
          {data.categories.map((category) => (
            <div key={category.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">{category.name}</h2>
                <span className="text-xs uppercase tracking-wide text-ink-muted">{category.points.length} item</span>
              </div>
              <div className="space-y-3">
                {category.points.map((point) => (
                  <div key={point.point_ref} className="rounded-xl border border-border bg-canvas p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-ink">{point.title}</p>
                        {point.instruction && <p className="text-xs text-ink-muted">{point.instruction}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right text-[11px] text-ink-muted">
                        {point.target_time && (
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatTime(point.target_time)}</span>
                        )}
                        {point.timing_label && (
                          <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-medium text-ink">{labelTiming(point.timing_label)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5">
                        {point.state === 'selesai' ? 'Selesai' : point.state === 'skip' ? 'Skip' : 'Belum'}
                      </span>
                      {point.completed_by_name && (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5" />
                          {point.completed_by_name}
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <ChecklistPointControls
                        point={point}
                        shiftId={shiftId}
                        disabled={data.shift.status !== 'berjalan'}
                        busy={busyPoint === point.point_ref}
                        onComplete={(value) => submitEntry(point, 'selesai', value)}
                        onCancel={() => submitEntry(point, 'batal')}
                        onSkip={(reason) => submitEntry(point, 'skip', reason)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-bold text-ink">Peserta shift</h3>
            <div className="mt-3 space-y-2">
              {data.participants.map((participant) => (
                <div key={participant.user_id} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{participant.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-ink-muted">{participant.first_action_type}</p>
                  </div>
                  <div className="text-right text-[11px] text-ink-muted">
                    <p>{participant.items_done} item</p>
                    {participant.is_pj && <p className="font-semibold text-emerald-700">PJ</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-bold text-ink">Handover</h3>
            <div className="mt-3 space-y-2 text-sm text-ink-muted">
              {data.handover_fields.length === 0 ? (
                <p>Belum ada field handover.</p>
              ) : (
                data.handover_fields.map((field) => (
                  <div key={field.id} className="rounded-lg border border-border bg-canvas px-3 py-2">
                    {field.label}
                    {field.is_required && <span className="ml-2 text-error">Wajib</span>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-base font-bold text-ink">Aksi shift</h3>
            <div className="mt-3 flex flex-col gap-3">
              {data.shift.status === 'berjalan' &&
                !data.participants.some((participant) => participant.user_id === userId) && (
                  <Button type="button" variant="secondary" onClick={() => void markOnDuty()}>
                    Saya bertugas
                  </Button>
                )}
              {data.shift.status === 'berjalan' && data.shift.pj_user_id === userId && (
                <ShiftCloseDialog
                  shiftId={shiftId}
                  isPj
                  missingRequiredItems={data.categories.flatMap((category) =>
                    category.points
                      .filter((point) => point.is_required && point.state === 'belum')
                      .map((point) => point.title)
                  )}
                  fields={data.handover_fields}
                  onClosed={loadProgress}
                />
              )}
              {data.shift.status !== 'berjalan' && (
                <p className="rounded-lg border border-border bg-canvas p-3 text-sm text-ink-muted">
                  Shift sudah ditutup. Checklist tampil hanya untuk dibaca.
                </p>
              )}
              <Button type="button" variant="outline" asChild>
                <Link href="/">Kembali ke beranda</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
