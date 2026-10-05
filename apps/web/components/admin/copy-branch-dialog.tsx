'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateNotice } from './template-notice';
import type { AdminBranch } from '@/lib/admin/api';

interface CopyBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cabang tujuan (cabang yang sedang dibuka) */
  targetBranch: AdminBranch;
  branches: AdminBranch[];
  saving?: boolean;
  error?: string | null;
  onSubmit: (sourceBranchId: string) => void;
}

/**
 * Salin seluruh template (shift, kategori SOP, checklist point, handover field)
 * dari cabang lain. Modul APP_FLOW §7: modal "Salin dari cabang lain (sumber, cakupan)".
 */
export function CopyBranchDialog({
  open,
  onOpenChange,
  targetBranch,
  branches,
  saving,
  error,
  onSubmit,
}: CopyBranchDialogProps) {
  const [sourceId, setSourceId] = useState('');

  useEffect(() => {
    if (open) setSourceId('');
  }, [open]);

  const options = branches.filter(
    (b) => b.isActive && b.id !== targetBranch.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salin template dari cabang lain</DialogTitle>
          <DialogDescription>
            Semua shift, kategori SOP, item checklist, dan bidang serah terima akan
            disalin ke {targetBranch.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="copy-source">Cabang sumber</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger id="copy-source">
                <SelectValue placeholder="Pilih cabang sumber" />
              </SelectTrigger>
              <SelectContent>
                {options.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TemplateNotice />
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="button" disabled={!sourceId || saving} onClick={() => onSubmit(sourceId)}>
              {saving ? 'Menyalin...' : 'Salin template'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
