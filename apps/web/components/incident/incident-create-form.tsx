'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Camera, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetugasNav } from '@/components/shift/petugas-nav';

interface Option {
  id: string;
  name: string;
}

interface IncidentOptions {
  categories: Option[];
  branches: Array<Option & { code: string }>;
}

interface ShiftResponse {
  shifts: Array<{
    branchId: string;
    name: string;
    timezone: string;
    today: string;
    instance: { shift_instance_id: string; status: string } | null;
  }>;
}

export function IncidentCreateForm() {
  const [options, setOptions] = useState<IncidentOptions>({ categories: [], branches: [] });
  const [shifts, setShifts] = useState<ShiftResponse['shifts']>([]);
  const [categoryId, setCategoryId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [shiftInstanceId, setShiftInstanceId] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [severity, setSeverity] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      try {
        const [incidentResponse, shiftResponse] = await Promise.all([
          fetch('/api/incidents', { cache: 'no-store', headers: { 'X-Requested-With': 'fetch' } }),
          fetch('/api/shifts', { cache: 'no-store', headers: { 'X-Requested-With': 'fetch' } }),
        ]);
        const incidentData = (await incidentResponse.json()) as IncidentOptions & { error?: string };
        const shiftData = (await shiftResponse.json()) as ShiftResponse & { error?: string };
        if (!incidentResponse.ok) throw new Error(incidentData.error || 'Gagal memuat kategori incident.');
        if (!shiftResponse.ok) throw new Error(shiftData.error || 'Gagal memuat pilihan shift.');
        setOptions(incidentData);
        const runningShifts = (shiftData.shifts ?? []).filter((shift) => shift.instance?.status === 'berjalan');
        setShifts(runningShifts);
        if (incidentData.branches[0]) setBranchId(incidentData.branches[0].id);
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : 'Gagal memuat pilihan form.', error: true });
      } finally {
        setLoading(false);
      }
    };
    void loadOptions();
  }, []);

  const branchShifts = shifts.filter((shift) => shift.branchId === branchId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!categoryId) {
      setMessage({ text: 'Pilih kategori incident.', error: true });
      return;
    }
    if (!branchId) {
      setMessage({ text: 'Pilih cabang incident.', error: true });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({
          categoryId,
          description: description.trim(),
          occurredAt: new Date(occurredAt).toISOString(),
          severity: severity || undefined,
          shiftInstanceId: shiftInstanceId || undefined,
          outsideShift: !shiftInstanceId,
        }),
      });
      const result = (await response.json()) as { error?: string; incident_id?: string };
      if (!response.ok || !result.incident_id) throw new Error(result.error || 'Incident gagal dibuat.');

      const uploadErrors: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set('file', file);
        formData.set('ownerType', 'incident');
        formData.set('ownerId', result.incident_id);
        formData.set('shiftInstanceId', shiftInstanceId);
        const uploadResponse = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: { 'X-Requested-With': 'fetch' },
          body: formData,
        });
        if (!uploadResponse.ok) {
          const uploadResult = (await uploadResponse.json()) as { error?: string };
          uploadErrors.push(uploadResult.error || `Foto ${file.name} gagal diunggah.`);
        }
      }

      if (uploadErrors.length) {
        setMessage({
          text: `Incident sudah dibuat, tetapi sebagian foto gagal diunggah: ${uploadErrors.join(' ')}`,
          error: true,
        });
      } else {
        window.location.href = '/incident';
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Gagal membuat incident.', error: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-2xl p-4"><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Memuat form…</div></main>;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 pb-24 md:p-6">
      <header>
        <Button asChild variant="outline" size="sm"><Link href="/incident"><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke incident</Link></Button>
        <h1 className="mt-4 text-2xl font-bold">Buat incident</h1>
        <p className="mt-1 text-sm text-ink-muted">Catat kejadian agar dapat ditindaklanjuti dan masuk ke laporan shift.</p>
      </header>

      {message && <div role="alert" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${message.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message.text}</div>}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-4 md:p-6">
        <label className="block space-y-1 text-sm font-medium">
          Cabang <span className="text-error">*</span>
          <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setShiftInstanceId(''); }} required className="min-h-12 w-full rounded-lg border border-border bg-canvas px-3 text-base">
            {options.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Kaitan shift
          <select value={shiftInstanceId} onChange={(event) => setShiftInstanceId(event.target.value)} className="min-h-12 w-full rounded-lg border border-border bg-canvas px-3 text-base">
            <option value="">Di luar shift</option>
            {branchShifts.map((shift) => (
              <option key={shift.instance!.shift_instance_id} value={shift.instance!.shift_instance_id}>{shift.name} · {shift.today}</option>
            ))}
          </select>
          {!branchShifts.length && <span className="block text-xs font-normal text-ink-muted">Tidak ada shift berjalan di cabang ini.</span>}
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Kategori <span className="text-error">*</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required className="min-h-12 w-full rounded-lg border border-border bg-canvas px-3 text-base">
            <option value="">Pilih kategori</option>
            {options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {!options.categories.length && <span className="block text-xs font-normal text-error">Belum ada kategori incident aktif; hubungi admin.</span>}
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Deskripsi kejadian <span className="text-error">*</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={3} maxLength={3000} required rows={5} className="w-full rounded-lg border border-border bg-canvas p-3 text-base" placeholder="Jelaskan apa yang terjadi, dampak, dan tindakan awal yang sudah dilakukan." />
          <span className="block text-right text-xs font-normal text-ink-muted">{description.length}/3000</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium">
            Waktu kejadian <span className="text-error">*</span>
            <input type="datetime-local" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="min-h-12 w-full rounded-lg border border-border bg-canvas px-3 text-base" />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Tingkat dampak
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="min-h-12 w-full rounded-lg border border-border bg-canvas px-3 text-base">
              <option value="">Tidak ditentukan</option>
              <option value="rendah">Rendah</option>
              <option value="sedang">Sedang</option>
              <option value="tinggi">Tinggi</option>
            </select>
          </label>
        </div>

        <label className="block space-y-2 text-sm font-medium">
          Foto bukti (maksimal 5)
          <span className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-canvas px-3 text-sm">
            <Camera className="h-4 w-4" /> Ambil / pilih foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                const valid = selected.filter((file) => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
                setFiles(valid.slice(0, 5));
                if (valid.length !== selected.length) {
                  setMessage({ text: 'Hanya foto gambar maksimal 5 MB yang dapat dipilih.', error: true });
                } else if (selected.length > 5) {
                  setMessage({ text: 'Maksimal 5 foto dipilih. Hanya 5 pertama yang akan diunggah.', error: false });
                }
              }}
            />
          </span>
          <span className="block text-xs font-normal text-ink-muted">{files.length} foto dipilih. Format gambar, maksimal 5 MB per foto.</span>
        </label>
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2 text-sm">
                <span className="truncate">{file.name}</span>
                <button type="button" className="ml-3 text-error underline" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}>Hapus</button>
              </li>
            ))}
          </ul>
        )}

        <div className="sticky bottom-2 -mx-1 flex justify-end rounded-xl bg-surface/95 p-1 backdrop-blur">
          <Button type="submit" className="min-h-12 w-full sm:w-auto" disabled={saving || !options.categories.length || !options.branches.length}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {saving ? 'Mengirim…' : 'Kirim incident'}
          </Button>
        </div>
      </form>
      <PetugasNav />
    </main>
  );
}
