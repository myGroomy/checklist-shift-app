'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HandoverField {
  id: string;
  label: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
}

export function ShiftCloseDialog({
  shiftId,
  isPj,
  missingRequiredItems,
  fields,
  onClosed,
}: {
  shiftId: string;
  isPj: boolean;
  missingRequiredItems: string[];
  fields: HandoverField[];
  onClosed: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState('');
  const [noIncident, setNoIncident] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportNumber, setReportNumber] = useState<string | null>(null);

  const missingFields = fields.filter(
    (field) => field.is_required && !(values[field.id] ?? '').trim()
  );

  const reset = () => {
    setStep(1);
    setValues({});
    setFreeText('');
    setNoIncident(false);
    setPin('');
    setError(null);
    setReportNumber(null);
  };

  const closeShift = async () => {
    if (pin.length !== 6) {
      setError('PIN harus terdiri dari 6 angka.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/shifts/${shiftId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({
          pin,
          values,
          free_text: freeText.trim() || undefined,
          no_incident: noIncident,
        }),
      });
      const result = (await response.json()) as { error?: string; report_number?: string };
      if (!response.ok) throw new Error(result.error || 'Shift gagal ditutup.');
      setReportNumber(result.report_number ?? 'Laporan dibuat');
      await onClosed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Shift gagal ditutup.');
    } finally {
      setBusy(false);
    }
  };

  if (!isPj) return null;

  return (
    <>
      <Button type="button" onClick={() => { reset(); setOpen(true); }}>
        Tutup Shift
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {reportNumber ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
              <DialogHeader className="mt-4">
                <DialogTitle>Shift berhasil ditutup</DialogTitle>
                <DialogDescription>Laporan {reportNumber} sudah dibuat dan dikunci.</DialogDescription>
              </DialogHeader>
              <Button asChild className="mt-6">
                <Link href="/">Kembali ke beranda</Link>
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Tutup Shift · Langkah {step} dari 3</DialogTitle>
                <DialogDescription>
                  Checklist akan dikunci dan laporan shift dibuat setelah konfirmasi PIN.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {step === 1 && (
                <section className="space-y-3">
                  <h3 className="font-semibold">Validasi checklist</h3>
                  {missingRequiredItems.length ? (
                    <>
                      <p className="text-sm text-ink-muted">
                        {missingRequiredItems.length} item wajib harus diselesaikan atau di-skip dengan alasan sebelum shift ditutup.
                      </p>
                      <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                        {missingRequiredItems.map((title) => (
                          <li key={title} className="text-sm">• {title}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Semua item wajib sudah selesai atau di-skip.
                    </p>
                  )}
                </section>
              )}

              {step === 2 && (
                <section className="max-h-[55dvh] space-y-4 overflow-y-auto pr-1">
                  <div>
                    <h3 className="font-semibold">Handover</h3>
                    <p className="mt-1 text-sm text-ink-muted">Isi informasi untuk shift berikutnya.</p>
                  </div>
                  {fields.map((field) => (
                    <label key={field.id} className="block space-y-1 text-sm font-medium">
                      {field.label}{field.is_required && <span className="text-error"> *</span>}
                      {field.field_type === 'pilihan' ? (
                        <select
                          value={values[field.id] ?? ''}
                          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
                        >
                          <option value="">Pilih</option>
                          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.field_type === 'ya_tidak' ? (
                        <select
                          value={values[field.id] ?? ''}
                          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
                        >
                          <option value="">Pilih</option>
                          <option value="Ya">Ya</option>
                          <option value="Tidak">Tidak</option>
                        </select>
                      ) : (
                        <input
                          type={field.field_type === 'angka' ? 'number' : 'text'}
                          value={values[field.id] ?? ''}
                          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
                          required={field.is_required}
                        />
                      )}
                    </label>
                  ))}
                  <label className="block space-y-1 text-sm font-medium">
                    Catatan tambahan
                    <textarea
                      value={freeText}
                      onChange={(event) => setFreeText(event.target.value)}
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-lg border border-border bg-surface p-3 text-base"
                      placeholder="Catatan untuk shift berikutnya (opsional)"
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3 text-sm">
                    <input type="checkbox" checked={noIncident} onChange={(event) => setNoIncident(event.target.checked)} className="h-5 w-5" />
                    Tidak ada incident yang perlu diteruskan
                  </label>
                </section>
              )}

              {step === 3 && (
                <section className="space-y-4">
                  <h3 className="font-semibold">Konfirmasi penutupan</h3>
                  <div className="rounded-lg border border-border bg-canvas p-3 text-sm">
                    <p>{fields.length} field handover ditinjau</p>
                    <p>{noIncident ? 'Tidak ada incident yang perlu diteruskan.' : 'Catatan incident tetap tersedia pada laporan.'}</p>
                    <p className="mt-2 font-semibold">Setelah ditutup, checklist tidak dapat diubah.</p>
                  </div>
                  <label className="block space-y-1 text-sm font-medium">
                    <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> PIN Anda</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      maxLength={6}
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
                      className="min-h-12 w-full rounded-lg border border-border bg-surface px-3 text-lg tracking-[0.4em]"
                    />
                  </label>
                </section>
              )}

              <DialogFooter className="gap-2">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={() => { setError(null); setStep((current) => current - 1); }} disabled={busy}>
                    Kembali
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => { setError(null); setStep((current) => current + 1); }}
                    disabled={step === 1 ? missingRequiredItems.length > 0 : missingFields.length > 0}
                  >
                    Lanjut
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void closeShift()} disabled={busy || pin.length !== 6}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {busy ? 'Menutup shift...' : 'Konfirmasi & tutup'}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
