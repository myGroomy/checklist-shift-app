'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Link2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/admin/api';

interface ReportRow {
  id: string;
  reportNumber: string;
  generatedAt: string;
  isLocked: boolean;
  archivePdfDriveUrl: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  shiftName: string;
  shiftDate: string;
  shiftStatus: string;
  pjName: string | null;
}

interface BranchRow {
  id: string;
  name: string;
  code: string;
}

interface ShareToken {
  id: string;
  expires_at: string;
  expired: boolean;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [activeTokens, setActiveTokens] = useState<Record<string, ShareToken[]>>({});
  const [newShareLinks, setNewShareLinks] = useState<Record<string, string>>({});

  const loadReports = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      if (date) params.set('date', date);
      const query = params.size ? `?${params.toString()}` : '';
      const [reportResult, branchResult] = await Promise.all([
        apiFetch<{ reports: ReportRow[] }>(`/api/admin/reports${query}`),
        apiFetch<{ branches: BranchRow[] }>('/api/admin/branches'),
      ]);
      setReports(reportResult.reports);
      setBranches(branchResult.branches);
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Gagal memuat laporan.',
        error: true,
      });
    } finally {
      setLoading(false);
    }
  }, [branchId, date]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const loadTokens = async (reportId: string) => {
    try {
      const result = await apiFetch<{ tokens: ShareToken[] }>(
        `/api/admin/reports/${reportId}/share`
      );
      setActiveTokens((current) => ({ ...current, [reportId]: result.tokens }));
    } catch {
      setNotice({ text: 'Gagal memuat status tautan berbagi.', error: true });
    }
  };

  useEffect(() => {
    for (const report of reports) void loadTokens(report.id);
    // Tokens are refreshed when the visible report rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const createShare = async (report: ReportRow) => {
    setBusyId(report.id);
    setNotice(null);
    try {
      const result = await apiFetch<{ token: string; expires_at: string }>(
        `/api/admin/reports/${report.id}/share`,
        { method: 'POST', json: { expiresHours: 720 } }
      );
      const url = `${window.location.origin}/r/${result.token}`;
      setNewShareLinks((current) => ({ ...current, [report.id]: url }));
      try {
        await navigator.clipboard.writeText(url);
        setNotice({ text: 'Tautan laporan dibuat dan disalin. Berlaku 30 hari.', error: false });
      } catch {
        setNotice({ text: 'Tautan dibuat. Gunakan tombol salin tautan di bawah.', error: false });
      }
      await loadTokens(report.id);
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Gagal membuat tautan laporan.',
        error: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const copyNewShareLink = async (reportId: string) => {
    const url = newShareLinks[reportId];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ text: 'Tautan berhasil disalin.', error: false });
    } catch {
      window.prompt('Salin tautan laporan ini:', url);
    }
  };

  const revokeShare = async (reportId: string, tokenId: string) => {
    setBusyId(reportId);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/reports/${reportId}/share/${tokenId}`, { method: 'DELETE' });
      setNotice({ text: 'Tautan laporan sudah dicabut.', error: false });
      await loadTokens(reportId);
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'Gagal mencabut tautan laporan.',
        error: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const whatsappShare = (report: ReportRow) => {
    const message = [
      `Laporan ${report.shiftName}`,
      `Cabang: ${report.branchName}`,
      `Tanggal: ${new Date(`${report.shiftDate}T00:00:00`).toLocaleDateString('id-ID')}`,
      `Nomor: ${report.reportNumber}`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Administrasi</p>
          <h1 className="mt-1 text-2xl font-bold">Laporan shift</h1>
          <p className="mt-1 text-sm text-ink-muted">Cari laporan, bagikan tautan publik, atau buka arsip foto.</p>
        </div>
        <Button variant="outline" onClick={() => void loadReports()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </Button>
      </header>

      <section className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-sm font-medium">
          Cabang
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-base"
          >
            <option value="">Semua cabang</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Tanggal shift
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-canvas px-3 text-base"
          />
        </label>
        <Button type="button" variant="outline" className="self-end" onClick={() => { setBranchId(''); setDate(''); }}>
          Hapus filter
        </Button>
      </section>

      {notice && (
        <div role="status" className={`rounded-xl border p-3 text-sm ${notice.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {notice.text}
        </div>
      )}

      <section className="space-y-3">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat laporan…
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-ink-muted" />
            <h2 className="mt-3 font-semibold">Belum ada laporan</h2>
            <p className="mt-1 text-sm text-ink-muted">Ubah filter atau periksa kembali setelah shift ditutup.</p>
          </div>
        ) : reports.map((report) => {
          const tokens = activeTokens[report.id] ?? [];
          const usableToken = tokens.find((token) => !token.expired);
          return (
            <article key={report.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{report.branchName} · {report.shiftName}</h2>
                    <span className={`rounded-full border px-2 py-1 text-xs ${report.shiftStatus === 'ditutup_paksa' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
                      {report.shiftStatus === 'ditutup_paksa' ? 'Ditutup paksa' : 'Ditutup'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {new Date(`${report.shiftDate}T00:00:00`).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                    {' · '}{report.reportNumber}
                    {' · PJ '}{report.pjName ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Dibuat {new Date(report.generatedAt).toLocaleString('id-ID')}
                  </p>
                  {usableToken && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                      <Link2 className="h-3.5 w-3.5" /> Tautan aktif sampai {new Date(usableToken.expires_at).toLocaleString('id-ID')}
                    </p>
                  )}
                  {newShareLinks[report.id] && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                      <a className="max-w-full break-all text-xs font-medium text-emerald-900 underline" href={newShareLinks[report.id]} target="_blank" rel="noreferrer">
                        Buka tautan publik
                      </a>
                      <Button type="button" size="sm" variant="outline" onClick={() => void copyNewShareLink(report.id)}>
                        Salin tautan
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void createShare(report)} disabled={busyId === report.id}>
                    {busyId === report.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    {usableToken ? 'Buat tautan baru' : 'Bagikan laporan'}
                  </Button>
                  {usableToken && (
                    <Button type="button" variant="outline" onClick={() => void revokeShare(report.id, usableToken.id)} disabled={busyId === report.id}>
                      <XCircle className="mr-2 h-4 w-4" /> Cabut tautan
                    </Button>
                  )}
                  {report.archivePdfDriveUrl && (
                    <Button asChild variant="outline">
                      <a href={report.archivePdfDriveUrl} target="_blank" rel="noreferrer">Arsip foto</a>
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => whatsappShare(report)}>
                    Bagikan WhatsApp
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
