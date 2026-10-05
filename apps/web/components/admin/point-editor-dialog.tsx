'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ChecklistPoint, InputType } from '@/lib/admin/api';

export interface PointFormValues {
  title: string;
  instruction: string | null;
  inputType: InputType;
  isRequired: boolean;
  targetTime: string | null;
  toleranceMinutes: number | null;
  activeDays: string[];
  numberMin: number | null;
  numberMax: number | null;
  sortOrder: number;
  isActive: boolean;
}

interface PointEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode buat */
  point?: ChecklistPoint | null;
  saving?: boolean;
  error?: string | null;
  onSubmit: (values: PointFormValues) => void;
}

export const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Sen' },
  { key: 'tue', label: 'Sel' },
  { key: 'wed', label: 'Rab' },
  { key: 'thu', label: 'Kam' },
  { key: 'fri', label: 'Jum' },
  { key: 'sat', label: 'Sab' },
  { key: 'sun', label: 'Min' },
];

const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: 'centang', label: 'Centang' },
  { value: 'foto', label: 'Foto' },
  { value: 'teks', label: 'Teks' },
  { value: 'angka', label: 'Angka' },
  { value: 'ok_tidak_ok', label: 'OK / Tidak OK' },
];

const EMPTY: PointFormValues = {
  title: '',
  instruction: null,
  inputType: 'centang',
  isRequired: true,
  targetTime: null,
  toleranceMinutes: null,
  activeDays: ALL_DAYS,
  numberMin: null,
  numberMax: null,
  sortOrder: 0,
  isActive: true,
};

const toNumber = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

export function PointEditorDialog({
  open,
  onOpenChange,
  point,
  saving,
  error,
  onSubmit,
}: PointEditorDialogProps) {
  const [values, setValues] = useState<PointFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (!point) {
      setValues(EMPTY);
      return;
    }
    setValues({
      title: point.title,
      instruction: point.instruction,
      inputType: point.inputType,
      isRequired: point.isRequired,
      targetTime: point.targetTime,
      toleranceMinutes: point.toleranceMinutes,
      activeDays: point.activeDays ? point.activeDays.split(',').filter(Boolean) : [],
      numberMin: point.numberMin,
      numberMax: point.numberMax,
      sortOrder: point.sortOrder,
      isActive: point.isActive,
    });
  }, [open, point]);

  const set = <K extends keyof PointFormValues>(key: K, value: PointFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) =>
    setValues((prev) => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter((d) => d !== day)
        : [...prev.activeDays, day],
    }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (values.title.trim().length < 2) return;
    if (values.activeDays.length === 0) return;
    onSubmit({ ...values, title: values.title.trim() });
  };

  const showNumber = values.inputType === 'angka';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {point ? 'Ubah item checklist' : 'Tambah item checklist'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="point-title">Judul item</Label>
            <Input
              id="point-title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="mis. Cek suhu kulkas"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="point-instruction">Petunjuk (opsional)</Label>
            <Textarea
              id="point-instruction"
              value={values.instruction ?? ''}
              onChange={(e) =>
                set('instruction', e.target.value.trim() === '' ? null : e.target.value)
              }
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="point-type">Tipe input</Label>
              <Select
                value={values.inputType}
                onValueChange={(v) => set('inputType', v as InputType)}
              >
                <SelectTrigger id="point-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INPUT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="point-target">Target waktu (HH:mm)</Label>
              <Input
                id="point-target"
                type="time"
                value={values.targetTime ?? ''}
                onChange={(e) =>
                  set('targetTime', e.target.value.trim() === '' ? null : e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="point-tolerance">Toleransi (menit)</Label>
            <Input
              id="point-tolerance"
              type="number"
              inputMode="numeric"
              value={values.toleranceMinutes ?? ''}
              onChange={(e) => set('toleranceMinutes', toNumber(e.target.value))}
            />
          </div>

          {showNumber && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="point-min">Nilai minimum</Label>
                <Input
                  id="point-min"
                  type="number"
                  inputMode="decimal"
                  value={values.numberMin ?? ''}
                  onChange={(e) => set('numberMin', toNumber(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="point-max">Nilai maksimum</Label>
                <Input
                  id="point-max"
                  type="number"
                  inputMode="decimal"
                  value={values.numberMax ?? ''}
                  onChange={(e) => set('numberMax', toNumber(e.target.value))}
                />
              </div>
            </div>
          )}
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Hari aktif</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const active = values.activeDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    aria-pressed={active}
                    className={`min-h-[40px] rounded-lg border px-3 text-sm ${
                      active
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border text-ink-muted'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {values.activeDays.length === 0 && (
              <p className="text-xs text-danger">Pilih minimal satu hari aktif</p>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="point-sort">Urutan</Label>
              <Input
                id="point-sort"
                type="number"
                inputMode="numeric"
                value={values.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.isRequired}
                  onChange={(e) => set('isRequired', e.target.checked)}
                  className="h-4 w-4"
                />
                Wajib
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                  className="h-4 w-4"
                />
                Aktif
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving || values.activeDays.length === 0}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
