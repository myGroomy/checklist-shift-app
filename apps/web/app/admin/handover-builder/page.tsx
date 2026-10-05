'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GripVertical, Pencil, Plus, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HandoverFieldEditor,
  type HandoverFormValues,
} from '@/components/admin/handover-field-editor';
import { TemplateNotice } from '@/components/admin/template-notice';
import {
  createHandoverField,
  deactivateHandoverField,
  listBranches,
  listHandoverFields,
  listShifts,
  updateHandoverField,
  type AdminBranch,
  type HandoverField,
  type ShiftDefinition,
} from '@/lib/admin/api';

const FIELD_TYPE_LABEL: Record<string, string> = {
  teks: 'Teks',
  angka: 'Angka',
  pilihan: 'Pilihan',
  ya_tidak: 'Ya / Tidak',
};

export default function HandoverBuilderPage() {
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [fields, setFields] = useState<HandoverField[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<HandoverField | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await listBranches();
        const active = data.branches.filter((b) => b.isActive);
        setBranches(active);
        if (active.length > 0) setBranchId((prev) => prev || active[0].id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal memuat cabang');
      }
    };
    loadBranches();
  }, []);

  useEffect(() => {
    if (!branchId) return;
    setShiftId('');
    listShifts(branchId)
      .then((data) => setShifts(data.shifts.filter((s) => s.isActive)))
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Gagal memuat shift')
      );
  }, [branchId]);

  const loadFields = useCallback(async (id: string) => {
    if (!id) {
      setFields([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listHandoverFields(id);
      setFields(data.fields);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat bidang serah terima');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFields(shiftId);
  }, [shiftId, loadFields]);

  const submitField = async (values: HandoverFormValues) => {
    if (!shiftId) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateHandoverField(editing.id, values);
        toast.success('Bidang serah terima diperbarui');
      } else {
        await createHandoverField(shiftId, values);
        toast.success('Bidang serah terima ditambahkan');
      }
      setEditorOpen(false);
      await loadFields(shiftId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan bidang serah terima';
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (field: HandoverField) => {
    try {
      if (field.isActive) {
        await deactivateHandoverField(field.id);
        toast.success('Bidang dinonaktifkan (tidak dihapus)');
      } else {
        await updateHandoverField(field.id, { isActive: true });
        toast.success('Bidang diaktifkan');
      }
      await loadFields(shiftId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  const swapOrder = async (from: number, to: number) => {
    const a = fields[from];
    const b = fields[to];
    if (!a || !b) return;
    const prev = fields;
    setFields((current) => {
      const next = [...current];
      next[from] = b;
      next[to] = a;
      return next;
    });
    try {
      await updateHandoverField(a.id, { sortOrder: b.sortOrder });
      await updateHandoverField(b.id, { sortOrder: a.sortOrder });
      toast.success('Urutan diperbarui');
    } catch (err) {
      setFields(prev);
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah urutan');
    }
  };

  const onDrop = (to: number) => {
    if (dragIndex === null || dragIndex === to) {
      setDragIndex(null);
      return;
    }
    void swapOrder(dragIndex, to);
    setDragIndex(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Handover Builder</h1>
        <p className="text-xs text-ink-muted">
          Daftar bidang serah terima per definisi shift. Seret baris untuk mengubah urutan.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="handover-branch" className="text-xs font-medium text-ink-muted">
            Cabang
          </label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger id="handover-branch">
              <SelectValue placeholder="Pilih cabang" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="handover-shift" className="text-xs font-medium text-ink-muted">
            Shift
          </label>
          <Select value={shiftId} onValueChange={setShiftId}>
            <SelectTrigger id="handover-shift">
              <SelectValue placeholder="Pilih shift" />
            </SelectTrigger>
            <SelectContent>
              {shifts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.startTime} - {s.endTime})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TemplateNotice />

      <div className="flex justify-end">
        <Button
          disabled={!shiftId}
          onClick={() => {
            setEditing(null);
            setFormError(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah bidang
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {!shiftId && <p className="p-4 text-sm text-ink-muted">Pilih shift terlebih dahulu</p>}
        {shiftId && loading && <p className="p-4 text-sm text-ink-muted">Memuat...</p>}
        {shiftId && !loading && fields.length === 0 && (
          <p className="p-4 text-sm text-ink-muted">Belum ada bidang serah terima</p>
        )}
        {shiftId &&
          !loading &&
          fields.map((f, index) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-2 border-b border-border p-3 last:border-b-0 ${
                dragIndex === index ? 'bg-primary/5' : ''
              }`}
            >
              <GripVertical
                className="h-4 w-4 shrink-0 cursor-grab text-ink-muted"
                aria-hidden
              />
              <div className="min-w-[140px] flex-1">
                <p className="text-sm font-medium">
                  {index + 1}. {f.label}
                  {f.isRequired && <span className="text-danger"> *</span>}
                </p>
                <p className="text-xs text-ink-muted">
                  {FIELD_TYPE_LABEL[f.fieldType] ?? f.fieldType}
                  {f.fieldType === 'pilihan' && f.options
                    ? ` · ${(Array.isArray(f.options) ? f.options : [f.options]).join(', ')}`
                    : ''}
                </p>
              </div>
              <Badge variant={f.isActive ? 'default' : 'secondary'}>
                {f.isActive ? 'Aktif' : 'Nonaktif'}
              </Badge>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(f);
                    setFormError(null);
                    setEditorOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Ubah
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleActive(f)}>
                  <Power className="h-3.5 w-3.5" />
                  {f.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            </div>
          ))}
      </div>

      <HandoverFieldEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        field={editing}
        saving={saving}
        error={formError}
        onSubmit={submitField}
      />
    </div>
  );
}
