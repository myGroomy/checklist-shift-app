'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Image as ImageIcon, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IncidentDetailData {
  incident: {
    id: string;
    branchName: string;
    shiftInstanceId: string | null;
    categoryName: string;
    description: string;
    occurredAt: string;
    reportedAt: string;
    reportedByName: string;
    status: string;
    severity: string | null;
  };
  notes: Array<{
    id: string;
    note: string;
    authorName: string;
    authorRole: string;
    createdAt: string;
  }>;
  photos: Array<{ id: string; uploadedAt: string | null; status: string }>;
}

export function IncidentDetail({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<IncidentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        cache: 'no-store',
        headers: { 'X-Requested-With': 'fetch' },
      });
      const result = (await response.json()) as IncidentDetailData & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Gagal memuat detail incident.');
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat detail incident.');
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => { void load(); }, [load]);

  const submitNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (note.trim().length < 1) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ note: note.trim() }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Catatan gagal disimpan.');
      setNote('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Catatan gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-3xl p-4"><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Memuat detail incident…</div></main>;
  if (!data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <Button asChild variant="outline"><Link href="/incident"><ArrowLeft className="mr-2 h-4 w-4" />Kembali</Link></Button>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? 'Incident tidak ditemukan.'}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-24 md:p-6">
      <Button asChild variant="outline"><Link href="/incident"><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke incident</Link></Button>
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <article className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-muted">{data.incident.branchName}</p>
            <h1 className="mt-1 text-2xl font-bold">{data.incident.categoryName}</h1>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${data.incident.status === 'open' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
            {data.incident.status === 'open' ? 'Terbuka' : 'Selesai'}
          </span>
        </div>
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-canvas p-4 text-sm leading-6">{data.incident.description}</p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Meta label="Waktu kejadian" value={new Date(data.incident.occurredAt).toLocaleString('id-ID')} />
          <Meta label="Dilaporkan oleh" value={`${data.incident.reportedByName} · ${new Date(data.incident.reportedAt).toLocaleString('id-ID')}`} />
          <Meta label="Kaitan shift" value={data.incident.shiftInstanceId ? 'Incident terkait shift' : 'Di luar shift'} />
          <Meta label="Tingkat dampak" value={data.incident.severity ?? 'Tidak ditentukan'} />
        </div>
      </article>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ImageIcon className="h-5 w-5" />Foto bukti</h2>
        {data.photos.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.photos.map((photo) => (
              <a key={photo.id} href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-canvas p-3 text-center text-xs hover:bg-surface">
                <ImageIcon className="h-6 w-6 text-ink-muted" />
                {photo.status === 'purged' ? 'Foto telah diarsip' : `Foto ${photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleDateString('id-ID') : 'bukti'}`}
              </a>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-ink-muted">Tidak ada foto bukti.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">Catatan tindak lanjut</h2>
        {data.notes.length ? (
          <ol className="mt-4 space-y-4">
            {data.notes.map((item) => (
              <li key={item.id} className="border-l-2 border-border pl-4">
                <p className="whitespace-pre-wrap text-sm">{item.note}</p>
                <p className="mt-1 text-xs text-ink-muted">{item.authorName} ({item.authorRole}) · {new Date(item.createdAt).toLocaleString('id-ID')}</p>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-sm text-ink-muted">Belum ada catatan tindak lanjut.</p>}
        <form onSubmit={submitNote} className="mt-5 space-y-3">
          <label className="block space-y-1 text-sm font-medium">
            Tambah catatan
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg border border-border bg-canvas p-3 text-base" placeholder="Catatan baru akan ditambahkan ke timeline; isi awal incident tidak diubah." />
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !note.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {saving ? 'Menyimpan…' : 'Simpan catatan'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-canvas p-3"><p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}
