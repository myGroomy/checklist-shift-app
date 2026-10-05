'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, CopyPlus, ExternalLink, Pencil, Plus, Power } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyBranchDialog } from '@/components/admin/copy-branch-dialog';
import { ShiftFormDialog, type ShiftFormValues } from '@/components/admin/shift-form-dialog';
import { ShiftPreviewDialog } from '@/components/admin/shift-preview-dialog';
import { TemplateNotice } from '@/components/admin/template-notice';
import {
  copyFromBranch,
  createShift,
  deactivateShift,
  duplicateShift,
  listBranches,
  listShifts,
  updateShift,
  type AdminBranch,
  type ShiftDefinition,
} from '@/lib/admin/api';

export default function ShiftPage() {
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copySaving, setCopySaving] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [previewShiftId, setPreviewShiftId] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const loadShifts = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await listShifts(id);
      setShifts(data.shifts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat definisi shift');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (branchId) loadShifts(branchId);
  }, [branchId, loadShifts]);

  const targetBranch = branches.find((b) => b.id === branchId) ?? null;

  const submitShift = async (values: ShiftFormValues) => {
    if (!branchId) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateShift(editing.id, values);
        toast.success('Definisi shift diperbarui');
      } else {
        await createShift(branchId, values);
        toast.success('Definisi shift ditambahkan');
      }
      setFormOpen(false);
      await loadShifts(branchId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan definisi shift';
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (shift: ShiftDefinition) => {
    try {
      if (shift.isActive) {
        await deactivateShift(shift.id);
        toast.success('Shift dinonaktifkan (tidak dihapus)');
      } else {
        await updateShift(shift.id, { isActive: true });
        toast.success('Shift diaktifkan');
      }
      await loadShifts(branchId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status shift');
    }
  };

  const duplicate = async (shift: ShiftDefinition) => {
    setBusyId(shift.id);
    try {
      await duplicateShift(shift.id);
      toast.success(`Shift "${shift.name}" diduplikasi lengkap dengan kategori & itemnya`);
      await loadShifts(branchId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menduplikasi shift');
    } finally {
      setBusyId(null);
    }
  };

  const submitCopy = async (sourceBranchId: string) => {
    if (!targetBranch) return;
    setCopySaving(true);
    setCopyError(null);
    try {
      await copyFromBranch(targetBranch.id, sourceBranchId);
      toast.success('Template berhasil disalin');
      setCopyOpen(false);
      await loadShifts(branchId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyalin template';
      setCopyError(message);
      toast.error(message);
    } finally {
      setCopySaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Shift</h1>
        <p className="text-xs text-ink-muted">
          Daftar definisi shift per cabang. Template di sini dipakai saat shift dibuka.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label htmlFor="shift-branch" className="text-xs font-medium text-ink-muted">
            Cabang
          </label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger id="shift-branch">
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
        <Button
          onClick={() => {
            setEditing(null);
            setFormError(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah shift
        </Button>
        <Button
          variant="outline"
          disabled={!targetBranch}
          onClick={() => {
            setCopyError(null);
            setCopyOpen(true);
          }}
        >
          <CopyPlus className="h-4 w-4" />
          Salin dari cabang lain
        </Button>
      </div>

      <TemplateNotice />

      <div className="rounded-xl border border-border bg-surface">
        {loading && <p className="p-4 text-sm text-ink-muted">Memuat...</p>}
        {!loading && shifts.length === 0 && (
          <p className="p-4 text-sm text-ink-muted">Belum ada definisi shift di cabang ini</p>
        )}
        {!loading &&
          shifts.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-2 border-b border-border p-3 last:border-b-0"
            >
              <div className="min-w-[160px] flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-ink-muted">
                  {s.startTime} - {s.endTime}
                  {s.crossesMidnight ? ' (lewat tengah malam)' : ''} · urutan {s.sortOrder ?? 0}
                </p>
              </div>
              <Badge variant={s.isActive ? 'default' : 'secondary'}>
                {s.isActive ? 'Aktif' : 'Nonaktif'}
              </Badge>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewShiftId(s.id)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Pratinjau
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === s.id}
                  onClick={() => void duplicate(s)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {busyId === s.id ? 'Menyalin...' : 'Duplikasi'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(s);
                    setFormError(null);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Ubah
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleActive(s)}>
                  <Power className="h-3.5 w-3.5" />
                  {s.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            </div>
          ))}
      </div>

      <ShiftFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        shift={editing}
        saving={saving}
        error={formError}
        onSubmit={submitShift}
      />

      <ShiftPreviewDialog
        open={previewShiftId !== ''}
        onOpenChange={(open) => {
          if (!open) setPreviewShiftId('');
        }}
        shiftId={previewShiftId}
      />

      {targetBranch && (
        <CopyBranchDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          targetBranch={targetBranch}
          branches={branches}
          saving={copySaving}
          error={copyError}
          onSubmit={submitCopy}
        />
      )}
    </div>
  );
}
