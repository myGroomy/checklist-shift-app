'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import type { HandoverField, HandoverFieldType } from '@/lib/admin/api';

export interface HandoverFormValues {
  label: string;
  fieldType: HandoverFieldType;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

interface HandoverFieldEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode buat */
  field?: HandoverField | null;
  saving?: boolean;
  error?: string | null;
  onSubmit: (values: HandoverFormValues) => void;
}

const FIELD_TYPES: { value: HandoverFieldType; label: string }[] = [
  { value: 'teks', label: 'Teks' },
  { value: 'angka', label: 'Angka' },
  { value: 'pilihan', label: 'Pilihan' },
  { value: 'ya_tidak', label: 'Ya / Tidak' },
];

const normalizeOptions = (raw: HandoverField['options'] | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  return String(raw).split(',').filter(Boolean);
};

export function HandoverFieldEditor({
  open,
  onOpenChange,
  field,
  saving,
  error,
  onSubmit,
}: HandoverFieldEditorProps) {
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<HandoverFieldType>('teks');
  const [options, setOptions] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLabel(field?.label ?? '');
    setFieldType(field?.fieldType ?? 'teks');
    setOptions(normalizeOptions(field?.options));
    setIsRequired(field?.isRequired ?? false);
    setSortOrder(field?.sortOrder ?? 0);
    setIsActive(field?.isActive ?? true);
  }, [open, field]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (trimmed.length < 2) return;
    const cleaned =
      fieldType === 'pilihan'
        ? options.map((o) => o.trim()).filter((o) => o.length > 0)
        : null;
    if (fieldType === 'pilihan' && (cleaned?.length ?? 0) === 0) return;
    onSubmit({ label: trimmed, fieldType, options: cleaned, isRequired, sortOrder, isActive });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {field ? 'Ubah bidang serah terima' : 'Tambah bidang serah terima'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="handover-label">Label</Label>
            <Input
              id="handover-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="mis. Catatan untuk shift berikutnya"
              required
              minLength={2}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="handover-type">Tipe isian</Label>
            <Select
              value={fieldType}
              onValueChange={(v) => setFieldType(v as HandoverFieldType)}
            >
              <SelectTrigger id="handover-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fieldType === 'pilihan' && (
            <div className="space-y-1">
              <Label htmlFor="handover-option">Pilihan (satu per baris)</Label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={opt}
                      aria-label={`Pilihan ${i + 1}`}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o, idx) => (idx === i ? e.target.value : o))
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Hapus pilihan ${i + 1}`}
                      onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((prev) => [...prev, ''])}
                >
                  Tambah pilihan
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="handover-sort">Urutan</Label>
              <Input
                id="handover-sort"
                type="number"
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4"
                />
                Wajib
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
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
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
