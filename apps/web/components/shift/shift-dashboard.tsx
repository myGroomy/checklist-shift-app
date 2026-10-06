'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FolderKanban, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetugasNav } from '@/components/shift/petugas-nav';

interface ShiftInstanceSummary {
  shift_instance_id: string;
  status: 'berjalan' | 'ditutup' | 'ditutup_paksa' | 'void';
  pj_user_id: string | null;
  opened_outside_hours?: boolean;
}

interface ShiftDefSummary {
  id: string;
  branchId: string;
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  sortOrder: number;
  timezone: string;
  today: string;
  instance: ShiftInstanceSummary | null;
}

interface BranchSummary {
  id: string;
  name: string;
  code: string;
  timezone: string;
}

interface ShiftsResponse {
  branches: BranchSummary[];
  shifts: ShiftDefSummary[];
  server_time: string;
}

function formatHHmm(value: string | null | undefined) {
  if (!value) return '-';
  return value.slice(0, 5);
}

export function ShiftDashboardClient({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [shifts, setShifts] = useState<ShiftDefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groupedByBranch = useMemo(() => {
    const map = new Map<string, ShiftDefSummary[]>();
    for (const item of shifts) {
      const bucket = map.get(item.branchId) ?? [];
      bucket.push(item);
      map.set(item.branchId, bucket);
    }
    return map;
  }, [shifts]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/shifts', {
          next: { revalidate: 30 },
          headers: { 'X-Requested-With': 'fetch' },
        });
        if (!res.ok) {
          throw new Error('Gagal memuat daftar shift');
        }
        const data = (await res.json()) as ShiftsResponse;
        setBranches(data.branches);
        setShifts(data.shifts);
      } catch {
        setNotice('Tidak dapat memuat data shift saat ini. Coba lagi sebentar.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const performAction = async (action: 'open' | 'join', shiftDefinitionId: string, instanceId?: string) => {
    setBusy(shiftDefinitionId);
    setNotice(null);
    try {
      const endpoint = action === 'open' ? '/api/shifts/open' : `/api/shifts/${instanceId}/join`;
      const body = action === 'open' ? { shiftDefinitionId } : undefined;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as {
        error?: string;
        status?: string;
        shift_instance_id?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Operasi shift gagal');
      }
      const nextId = data.shift_instance_id ?? instanceId;
      if (nextId) {
        router.push(`/shift/${nextId}`);
        return;
      }
      setNotice('Aksi shift berhasil diproses.');
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Operasi shift gagal.');
    } finally {
      setBusy(null);
    }
  };

  const renderShiftAction = (item: ShiftDefSummary) => {
    const instance = item.instance;
    if (!instance) {
      return (
        <Button
          type="button"
          className="w-full justify-center"
          onClick={() => void performAction('open', item.id)}
          disabled={busy === item.id}
        >
          {busy === item.id ? 'Memproses...' : 'Buka Shift'}
        </Button>
      );
    }

    if (instance.status === 'berjalan') {
      const isPj = instance.pj_user_id === userId;
      return (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" asChild>
            <Link href={`/shift/${instance.shift_instance_id}`}>{isPj ? 'Lanjutkan' : 'Check-in'}</Link>
          </Button>
          {!isPj && (
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => void performAction('join', item.id, instance.shift_instance_id)}
              disabled={busy === item.id}
            >
              {busy === item.id ? 'Bergabung...' : 'Gabung'}
            </Button>
          )}
        </div>
      );
    }

    return (
      <Button type="button" variant="secondary" className="w-full justify-center" asChild>
        <Link href={`/shift/${instance.shift_instance_id}`}>Lihat status</Link>
      </Button>
    );
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-24 md:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Checklist-shift</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">Halo, {userName}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink-muted">
          <Clock3 className="h-4 w-4" />
          {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Cabang akses</p>
          <p className="mt-2 text-2xl font-bold text-ink">{branches.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Shift berjalan</p>
          <p className="mt-2 text-2xl font-bold text-ink">
            {shifts.filter((item) => item.instance && item.instance.status === 'berjalan').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Status</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Online
          </p>
        </div>
      </section>

      <section id="daftar-shift" className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
            Memuat daftar shift...
          </div>
        ) : branches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
            Tidak ada cabang yang bisa diakses.
          </div>
        ) : (
          branches.map((branch) => {
            const items = groupedByBranch.get(branch.id) ?? [];
            return (
              <div key={branch.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-muted">{branch.code}</p>
                    <h2 className="mt-1 text-lg font-bold text-ink">{branch.name}</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-canvas px-2.5 py-1 text-xs text-ink-muted">
                    <FolderKanban className="h-3.5 w-3.5" />
                    {branch.timezone}
                  </div>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-canvas p-4 text-sm text-ink-muted">
                      Tidak ada template shift aktif untuk cabang ini.
                    </div>
                  ) : (
                    items.map((item) => {
                      const instance = item.instance;
                      const statusText = !instance
                        ? 'Belum dibuka'
                        : instance.status === 'berjalan'
                          ? 'Berjalan'
                          : instance.status === 'ditutup'
                            ? 'Ditutup'
                            : 'Status lain';
                      return (
                        <div key={item.id} className="rounded-xl border border-border bg-canvas p-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-ink">{item.name}</h3>
                                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">
                                  {statusText}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                                <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatHHmm(item.startTime)} - {formatHHmm(item.endTime)}</span>
                                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{instance ? 'Aktif' : 'Siap dibuka'}</span>
                              </div>
                            </div>
                            <div className="flex min-w-[180px] items-center justify-end">
                              {renderShiftAction(item)}
                            </div>
                          </div>
                          {instance && instance.status === 'berjalan' && (
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Shift dibuka pada {item.today}
                              </span>
                              <Link href={`/shift/${instance.shift_instance_id}`} className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                Lanjutkan <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
      <PetugasNav />
    </main>
  );
}
