'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { fetchShiftPreview, type ShiftPreview } from '@/lib/admin/api';

interface ShiftPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
}

const INPUT_TYPE_LABEL: Record<string, string> = {
  centang: 'Centang',
  foto: 'Foto',
  teks: 'Teks',
  angka: 'Angka',
  ok_tidak_ok: 'OK / Tidak OK',
};

const FIELD_TYPE_LABEL: Record<string, string> = {
  teks: 'Teks',
  angka: 'Angka',
  pilihan: 'Pilihan',
  ya_tidak: 'Ya / Tidak',
};

/**
 * Pratinjau checklist read-only seperti yang dilihat petugas, memakai template
 * aktif shift definisi yang dipilih (Fase 3c).
 */
export function ShiftPreviewDialog({ open, onOpenChange, shiftId }: ShiftPreviewDialogProps) {
  const [data, setData] = useState<ShiftPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !shiftId) return;
    setLoading(true);
    setData(null);
    fetchShiftPreview(shiftId)
      .then(setData)
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Gagal memuat pratinjau')
      )
      .finally(() => setLoading(false));
  }, [open, shiftId]);

  const activeCategories = (data?.categories ?? []).filter((c) => c.isActive);
  const activeFields = (data?.handoverFields ?? []).filter((f) => f.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pratinjau checklist</DialogTitle>
          <DialogDescription>
            Tampilan read-only seperti yang dilihat petugas. Ini data uji, tidak menyimpan
            apa pun.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-ink-muted">Memuat...</p>}
        {!loading && data && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm font-semibold">{data.shift.name}</p>
              <p className="text-xs text-ink-muted">
                {data.shift.startTime} - {data.shift.endTime}
                {data.shift.crossesMidnight ? ' (lewat tengah malam)' : ''}
              </p>
            </div>

            {activeCategories.length === 0 && (
              <p className="text-sm text-ink-muted">Belum ada kategori aktif pada shift ini</p>
            )}

            {activeCategories.map((cat) => (
              <section key={cat.id} className="space-y-2">
                <h3 className="text-sm font-semibold">{cat.name}</h3>
                {cat.points.filter((p) => p.isActive).length === 0 && (
                  <p className="text-xs text-ink-muted">Belum ada item aktif</p>
                )}
                <ul className="space-y-2">
                  {cat.points
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-2 rounded-lg border border-border p-2"
                      >
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-[10px] text-ink-muted"
                          aria-hidden
                        >
                          {p.inputType === 'angka' ? '#' : '✓'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            {p.title}
                            {p.isRequired && <span className="text-danger"> *</span>}
                          </p>
                          {p.instruction && (
                            <p className="text-xs text-ink-muted">{p.instruction}</p>
                          )}
                          <p className="text-xs text-ink-muted">
                            {INPUT_TYPE_LABEL[p.inputType] ?? p.inputType}
                            {p.targetTime ? ` · target ${p.targetTime}` : ''}
                            {p.toleranceMinutes !== null
                              ? ` · toleransi ${p.toleranceMinutes} menit`
                              : ''}
                            {p.numberMin !== null || p.numberMax !== null
                              ? ` · ${p.numberMin ?? '-'} s.d. ${p.numberMax ?? '-'}`
                              : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            ))}

            {activeFields.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Serah terima</h3>
                <ul className="space-y-1">
                  {activeFields.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      <span>{f.label}</span>
                      {f.isRequired && <span className="text-danger">*</span>}
                      <Badge variant="secondary">
                        {FIELD_TYPE_LABEL[f.fieldType] ?? f.fieldType}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
