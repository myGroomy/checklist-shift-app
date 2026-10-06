'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetugasNav } from '@/components/shift/petugas-nav';

interface ReportItem {
  id: string;
  reportNumber: string;
  generatedAt: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  shiftName: string;
  shiftDate: string;
  shiftStatus: string;
  pjName: string | null;
}

export function ReportList() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/reports', {
          next: { revalidate: 30 },
          headers: { 'X-Requested-With': 'fetch' },
        });
        const result = (await response.json()) as { error?: string; reports?: ReportItem[] };
        if (!response.ok) throw new Error(result.error || 'Gagal memuat laporan.');
        setReports(result.reports ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Gagal memuat laporan.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 pb-24 md:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Riwayat</p>
        <h1 className="mt-1 text-2xl font-bold">Laporan shift</h1>
        <p className="mt-1 text-sm text-ink-muted">Laporan dari cabang yang dapat Anda akses.</p>
      </header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Memuat laporan…</div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-ink-muted" />
          <h2 className="mt-3 font-semibold">Belum ada laporan shift</h2>
          <p className="mt-1 text-sm text-ink-muted">Laporan akan tersedia setelah Penanggung Jawab menutup shift.</p>
          <Button asChild variant="outline" className="mt-4"><Link href="/">Kembali ke beranda</Link></Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link key={report.id} href={`/report/${report.id}`} className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-ink-muted">{report.branchCode} · {report.reportNumber}</p>
                  <h2 className="mt-1 truncate font-semibold">{report.branchName} · {report.shiftName}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {new Date(`${report.shiftDate}T00:00:00`).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                    {' · PJ '}{report.pjName ?? '—'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${report.shiftStatus === 'ditutup_paksa' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
                  {report.shiftStatus === 'ditutup_paksa' ? 'Ditutup paksa' : 'Ditutup'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-muted">
                <span>Dibuat {new Date(report.generatedAt).toLocaleString('id-ID')}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-ink">Lihat laporan <ArrowRight className="h-3.5 w-3.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <PetugasNav />
    </main>
  );
}
