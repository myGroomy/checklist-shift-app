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
import type { ShiftDefinition } from '@/lib/admin/api';

export interface ShiftFormValues {
  name: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  sortOrder: number;
  isActive: boolean;
}

interface ShiftFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode buat, terisi = mode ubah */
  shift?: ShiftDefinition | null;
  saving?: boolean;
  error?: string | null;
  onSubmit: (values: ShiftFormValues) => void;
}

const EMPTY: ShiftFormValues = {
  name: '',
  startTime: '07:00',
  endTime: '15:00',
  crossesMidnight: false,
  sortOrder: 0,
  isActive: true,
};

export function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
  saving,
  error,
  onSubmit,
}: ShiftFormDialogProps) {
  const [values, setValues] = useState<ShiftFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setValues(
      shift
        ? {
            name: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            crossesMidnight: shift.crossesMidnight,
            sortOrder: shift.sortOrder ?? 0,
            isActive: shift.isActive,
          }
        : EMPTY
    );
  }, [open, shift]);

  const set = <K extends keyof ShiftFormValues>(key: K, value: ShiftFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (values.name.trim().length < 2) return;
    onSubmit({ ...values, name: values.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? 'Ubah definisi shift' : 'Tambah definisi shift'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="shift-name">Nama shift</Label>
            <Input
              id="shift-name"
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="mis. Shift Pagi"
              required
              minLength={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="shift-start">Mulai (HH:mm)</Label>
              <Input
                id="shift-start"
                type="time"
                value={values.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-end">Selesai (HH:mm)</Label>
              <Input
                id="shift-end"
                type="time"
                value={values.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.crossesMidnight}
              onChange={(e) => set('crossesMidnight', e.target.checked)}
              className="h-4 w-4"
            />
            Melewati tengah malam
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="shift-sort">Urutan</Label>
              <Input
                id="shift-sort"
                type="number"
                inputMode="numeric"
                value={values.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="h-4 w-4"
              />
              Aktif
            </label>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
