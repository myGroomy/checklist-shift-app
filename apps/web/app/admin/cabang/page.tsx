'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/admin/api';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

interface BranchForm {
  id?: string;
  name: string;
  code: string;
  address: string;
  timezone: string;
}

const EMPTY_FORM: BranchForm = { name: '', code: '', address: '', timezone: 'Asia/Jakarta' };

export default function CabangPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tzList, setTzList] = useState<string[]>([
    'Asia/Jakarta',
    'Asia/Pontianak',
    'Asia/Makassar',
    'Asia/Jayapura',
    'UTC',
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ branches: Branch[] }>('/api/admin/branches');
      setBranches(data.branches);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat cabang');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    if (supported && supported.length > 0) setTzList(supported);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (b: Branch) => {
    setForm({
      id: b.id,
      name: b.name,
      code: b.code,
      address: b.address ?? '',
      timezone: b.timezone,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.name.trim().length < 2) {
      setFormError('Nama cabang minimal 2 karakter');
      return;
    }
    if (form.code.trim().length < 2 || form.code.trim().length > 10) {
      setFormError('Kode cabang harus 2–10 karakter');
      return;
    }
    if (!form.timezone.trim()) {
      setFormError('Zona waktu wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        timezone: form.timezone.trim(),
      };
      if (form.id) {
        await apiFetch(`/api/admin/branches/${form.id}`, { method: 'PUT', json: payload });
        toast.success('Cabang diperbarui');
      } else {
        await apiFetch('/api/admin/branches', { method: 'POST', json: payload });
        toast.success('Cabang dibuat');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan cabang');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Branch) => {
    try {
      await apiFetch(`/api/admin/branches/${b.id}`, {
        method: 'PUT',
        json: { isActive: !b.isActive },
      });
      toast.success(
        b.isActive ? `Cabang ${b.code} dinonaktifkan` : `Cabang ${b.code} diaktifkan`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status cabang');
    }
  };

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.code.toLowerCase().includes(query.toLowerCase())
  );
  const activeCount = branches.filter((b) => b.isActive).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Cabang</h1>
          <p className="text-xs text-ink-muted">Daftar cabang beserta zona waktunya</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tambah Cabang
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama / kode cabang"
          className="pl-9"
          aria-label="Cari cabang"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Zona Waktu</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-ink-muted">
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-ink-muted">
                  Belum ada cabang
                </TableCell>
              </TableRow>
            )}
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.code}</TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="max-w-56 text-xs text-ink-muted">
                  {b.address || '—'}
                </TableCell>
                <TableCell className="text-xs">{b.timezone}</TableCell>
                <TableCell>
                  <Badge variant={b.isActive ? 'default' : 'secondary'}>
                    {b.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Ubah
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(b)}
                      disabled={b.isActive && activeCount <= 1}
                      title={
                        b.isActive && activeCount <= 1
                          ? 'Tidak boleh menonaktifkan semua cabang aktif'
                          : undefined
                      }
                    >
                      {b.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Ubah Cabang' : 'Tambah Cabang'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-error-bg p-3 text-xs font-medium text-error"
              >
                {formError}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="branch-name">
                Nama <span className="text-error">*</span>
              </Label>
              <Input
                id="branch-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bandung Pusat"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="branch-code">
                Kode <span className="text-error">*</span>
              </Label>
              <Input
                id="branch-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="BDG01"
                maxLength={10}
                required
              />
              <p className="text-[11px] text-ink-light">2–10 karakter, unik antar cabang</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="branch-address">Alamat</Label>
              <Input
                id="branch-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Jl. Merdeka No. 1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="branch-tz">
                Zona Waktu (IANA) <span className="text-error">*</span>
              </Label>
              <Input
                id="branch-tz"
                list="tz-options"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                placeholder="Asia/Jakarta"
                required
              />
              <datalist id="tz-options">
                {tzList.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
              <p className="text-[11px] text-ink-light">Contoh: Asia/Jakarta, Asia/Makassar</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


