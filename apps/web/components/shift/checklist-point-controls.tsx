'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InputType = 'centang' | 'foto' | 'teks' | 'angka' | 'ok_tidak_ok';
type EntryState = 'belum' | 'selesai' | 'skip';

interface Point {
  point_ref: string;
  input_type: InputType;
  state: EntryState;
  value: string | null;
  skip_reason: string | null;
  out_of_range: boolean;
  number_min: number | null;
  number_max: number | null;
}

async function compressPhoto(source: File): Promise<File> {
  if (source.size > 15 * 1024 * 1024) {
    throw new Error('Foto sumber maksimal 15 MB.');
  }

  const image = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser tidak dapat memproses foto.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  for (const quality of [0.82, 0.68, 0.54, 0.4, 0.28]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (!blob) throw new Error('Foto gagal dikompres.');
    if (blob.type !== 'image/webp') {
      throw new Error('Browser tidak mendukung kompresi foto WebP.');
    }
    if (blob.size <= 150 * 1024) {
      return new File([blob], 'bukti.webp', { type: 'image/webp' });
    }
  }

  throw new Error('Foto masih lebih dari 150 KB setelah dikompres. Pilih foto lain.');
}

export function ChecklistPointControls({
  point,
  shiftId,
  disabled,
  busy,
  onComplete,
  onCancel,
  onSkip,
}: {
  point: Point;
  shiftId: string;
  disabled: boolean;
  busy: boolean;
  onComplete: (value: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onSkip: (reason: string) => Promise<void>;
}) {
  const [value, setValue] = useState(point.value ?? '');
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const finishSkip = async () => {
    if (skipReason.trim().length < 3) return;
    await onSkip(skipReason.trim());
    setSkipOpen(false);
    setSkipReason('');
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const compressed = await compressPhoto(file);
      const form = new FormData();
      form.set('file', compressed);
      form.set('ownerType', 'entry');
      form.set('ownerId', point.point_ref);
      form.set('shiftInstanceId', shiftId);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
        body: form,
      });
      const result = (await response.json()) as { error?: string; photo_id?: string };
      if (!response.ok || !result.photo_id) {
        throw new Error(result.error || 'Foto gagal diunggah.');
      }
      await onComplete(result.photo_id);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Foto gagal diunggah.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (point.state !== 'belum') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {point.state === 'skip' ? (
          <p className="text-sm text-ink-muted">Alasan skip: {point.skip_reason || '—'}</p>
        ) : (
          <p className="text-sm text-ink-muted">
            {point.input_type === 'foto' ? 'Foto tersimpan' : `Nilai: ${point.value ?? 'Selesai'}`}
            {point.out_of_range ? ' • Di luar rentang' : ''}
          </p>
        )}
        {!disabled && (
          <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Batalkan
          </Button>
        )}
      </div>
    );
  }

  const actions = (
    <Button type="button" size="sm" variant="secondary" onClick={() => setSkipOpen(true)} disabled={disabled || busy || uploading}>
      <SkipForward className="mr-1 h-4 w-4" />
      Skip dengan alasan
    </Button>
  );

  let input;
  if (point.input_type === 'centang') {
    input = <Button type="button" onClick={() => void onComplete('true')} disabled={disabled || busy}>{busy ? 'Menyimpan...' : 'Tandai selesai'}</Button>;
  } else if (point.input_type === 'ok_tidak_ok') {
    input = (
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onComplete('ya')} disabled={disabled || busy}>OK</Button>
        <Button type="button" variant="outline" onClick={() => void onComplete('tidak')} disabled={disabled || busy}>Tidak OK</Button>
      </div>
    );
  } else if (point.input_type === 'teks' || point.input_type === 'angka') {
    input = (
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label={point.input_type === 'angka' ? 'Nilai angka' : 'Catatan checklist'}
          type={point.input_type === 'angka' ? 'number' : 'text'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          min={point.number_min ?? undefined}
          max={point.number_max ?? undefined}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-base"
          placeholder={point.input_type === 'angka' ? 'Masukkan angka' : 'Tulis catatan'}
          disabled={disabled || busy}
        />
        <Button type="button" onClick={() => void onComplete(value)} disabled={disabled || busy || !value.trim()}>
          Simpan
        </Button>
      </div>
    );
  } else {
    input = (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => void uploadPhoto(event.target.files?.[0])}
          disabled={disabled || busy || uploading}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={disabled || busy || uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {uploading ? 'Mengompres & mengunggah...' : 'Ambil / pilih foto'}
        </Button>
        <p className="mt-1 text-xs text-ink-muted">Foto otomatis dikompres maksimal 150 KB sebelum diunggah.</p>
        {photoError && <p role="alert" className="mt-2 text-sm text-error">{photoError}</p>}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {input}
      {actions}
      {skipOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby={`skip-title-${point.point_ref}`} className="w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl">
            <h2 id={`skip-title-${point.point_ref}`} className="text-lg font-bold">Alasan melewati item</h2>
            <p className="mt-1 text-sm text-ink-muted">Alasan ini akan tersimpan di laporan shift.</p>
            <textarea
              autoFocus
              value={skipReason}
              onChange={(event) => setSkipReason(event.target.value)}
              maxLength={500}
              rows={4}
              className="mt-4 w-full rounded-lg border border-border bg-canvas p-3 text-base"
              placeholder="Jelaskan mengapa item tidak dapat dikerjakan"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSkipOpen(false)}>Batal</Button>
              <Button type="button" onClick={() => void finishSkip()} disabled={busy || skipReason.trim().length < 3}>
                Simpan alasan
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
