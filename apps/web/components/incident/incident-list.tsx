'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetugasNav } from '@/components/shift/petugas-nav';

interface Incident {
  id: string;
  branchId: string;
  branchName: string;
  shiftInstanceId: string | null;
  categoryName: string;
  description: string;
  occurredAt: string;
  reportedAt: string;
  reportedByName: string;
  status: 'open' | 'selesai';
  severity: 'rendah' | 'sedang' | 'tinggi' | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export function IncidentList() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/incidents', {
        next: { revalidate: 30 },
        headers: { 'X-Requested-With': 'fetch' },
      });
      const result = (await response.json()) as {
        error?: string;
        branches?: Branch[];
        incidents?: Incident[];
      };
      if (!response.ok) throw new Error(result.error || 'Gagal memuat incident.');
      setBranches(result.branches ?? []);
      setIncidents(result.incidents ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat incident.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = incidents.filter((incident) => !branchId || incident.branchId === branchId);

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Operasional</p>
          <h1 className="mt-1 text-2xl font-bold">Incident</h1>
          <p className="mt-1 text-sm text-ink-muted">Lihat laporan incident dan tindak lanjut cabang Anda.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} aria-label="Muat ulang incident">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild><Link href="/incident/baru"><Plus className="mr-2 h-4 w-4" />Buat Incident</Link></Button>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <label className="block space-y-1 text-sm font-medium">
        Filter cabang
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base">
          <option value="">Semua cabang</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>

      {loading ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-ink-muted">Memuat daftar incident…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-ink-muted" />
          <h2 className="mt-3 font-semibold">Tidak ada incident</h2>
          <p className="mt-1 text-sm text-ink-muted">Incident baru akan muncul di sini.</p>
          <Button asChild className="mt-4"><Link href="/incident/baru">Buat incident pertama</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((incident) => (
            <Link key={incident.id} href={`/incident/${incident.id}`} className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{incident.categoryName}</h2>
                  <p className="mt-1 text-sm text-ink-muted">{incident.branchName}{incident.shiftInstanceId ? ' · Terkait shift' : ' · Di luar shift'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${incident.status === 'open' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
                  {incident.status === 'open' ? 'Terbuka' : 'Selesai'}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{incident.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span>Kejadian: {new Date(incident.occurredAt).toLocaleString('id-ID')}</span>
                <span>Dilaporkan {incident.reportedByName}</span>
                {incident.severity && <span>Tingkat: {incident.severity}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <PetugasNav />
    </main>
  );
}
