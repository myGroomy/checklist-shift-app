'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface SensitiveActionValues {
  reason: string;
  pin: string;
  newPin?: string;
}

interface SensitiveActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Ringkasan dampak yang ditampilkan ke admin */
  impact: string;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  /** Tampilkan input PIN baru (untuk reset PIN) */
  withNewPin?: boolean;
  onSubmit: (values: SensitiveActionValues) => void;
}

/**
 * Komponen aksi sensitif reusable (Fase 3a):
 * ringkasan dampak + alasan wajib + konfirmasi PIN.
 */
export function SensitiveActionDialog({
  open,
  onOpenChange,
  title,
  impact,
  confirmLabel = 'Konfirmasi',
  loading = false,
  error,
  withNewPin = false,
  onSubmit,
}: SensitiveActionDialogProps) {
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Reset isian setiap kali dialog dibuka
  useEffect(() => {
    if (open) {
      setReason('');
      setPin('');
      setNewPin('');
    }
  }, [open]);

  const reasonValid = reason.trim().length >= 3;
  const pinValid = /^\d{6}$/.test(pin);
  const newPinValid = !withNewPin || /^\d{6}$/.test(newPin);
  const canSubmit = reasonValid && pinValid && newPinValid && !loading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ reason: reason.trim(), pin, ...(withNewPin ? { newPin } : {}) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="rounded-lg border border-warning-border bg-warning-bg p-3 text-xs text-ink">
              <span className="mb-1 block font-semibold uppercase tracking-wide">
                Dampak aksi
              </span>
              {impact}
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-error-bg p-3 text-xs font-medium text-error"
            >
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="sa-reason">
              Alasan <span className="text-error">*</span>
            </Label>
            <Textarea
              id="sa-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tulis alasan aksi ini (min. 3 karakter)"
              rows={3}
              required
            />
            {reason.length > 0 && !reasonValid && (
              <p className="text-[11px] text-error">Alasan minimal 3 karakter</p>
            )}
          </div>

          {withNewPin && (
            <div className="space-y-1">
              <Label htmlFor="sa-newpin">
                PIN Baru (6 digit) <span className="text-error">*</span>
              </Label>
              <Input
                id="sa-newpin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="6 digit angka"
                autoComplete="off"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="sa-pin">
              PIN Konfirmasi Admin <span className="text-error">*</span>
            </Label>
            <Input
              id="sa-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Masukkan PIN Anda"
              autoComplete="off"
            />
            {!pinValid && pin.length > 0 && (
              <p className="text-[11px] text-error">PIN harus 6 angka</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {loading ? 'Memproses...' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
