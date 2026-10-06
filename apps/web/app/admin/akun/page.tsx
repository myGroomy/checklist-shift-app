'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  KeyRound,
  LockOpen,
  LogOut,
  Pencil,
  Plus,
  UserX,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/admin/api';
import {
  SensitiveActionDialog,
  type SensitiveActionValues,
} from '@/components/admin/sensitive-action';

type Role = 'admin' | 'petugas';

interface BranchOption {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  mustChangePin: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  branches: BranchOption[];
}

interface UserForm {
  name: string;
  username: string;
  initialPin: string;
  role: Role;
  branchIds: string[];
}

type SensitiveJob =
  | {
      kind: 'user-update';
      user: AdminUser;
      payload: Record<string, unknown>;
      impact: string;
      successMsg: string;
    }
  | { kind: 'reset-pin'; user: AdminUser }
  | { kind: 'unlock'; user: AdminUser }
  | { kind: 'force-logout'; user: AdminUser };

const EMPTY_FORM: UserForm = {
  name: '',
  username: '',
  initialPin: '',
  role: 'petugas',
  branchIds: [],
};

export default function AkunPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [job, setJob] = useState<SensitiveJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, b] = await Promise.all([
        apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
        apiFetch<{ branches: BranchOption[] }>('/api/admin/branches'),
      ]);
      setUsers(u.users);
      setBranches(b.branches);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data akun');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setForm({
      name: u.name,
      username: u.username,
      initialPin: '',
      role: u.role,
      branchIds: u.branches.map((b) => b.id),
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.name.trim().length < 2) return setFormError('Nama minimal 2 karakter');
    if (form.branchIds.length === 0) return setFormError('Pilih minimal satu cabang akses');

    if (!editUser) {
      if (form.username.trim().length < 3 || !/^[a-zA-Z0-9._-]+$/.test(form.username.trim()))
        return setFormError('Username minimal 3 karakter (huruf, angka, titik, strip, underscore)');
      if (!/^\d{6}$/.test(form.initialPin)) return setFormError('PIN awal harus 6 angka');
    }

    setSaving(true);
    try {
      if (editUser) {
        const payload: Record<string, unknown> = { name: form.name.trim() };
        const roleChanged = form.role !== editUser.role;
        const oldIds = editUser.branches.map((b) => b.id).sort();
        const newIds = [...form.branchIds].sort();
        const accessChanged = JSON.stringify(oldIds) !== JSON.stringify(newIds);
        if (roleChanged) payload.role = form.role;
        if (accessChanged) payload.branchIds = form.branchIds;

        if (roleChanged || accessChanged) {
          // Peran/akses = aksi sensitif -> konfirmasi alasan + PIN
          setFormOpen(false);
          setJobError(null);
          setJob({
            kind: 'user-update',
            user: editUser,
            payload,
            impact: roleChanged
              ? `Peran ${editUser.name} berubah dari "${editUser.role}" menjadi "${form.role}". ${
                  accessChanged ? 'Akses cabang juga diubah. ' : ''
                }Perubahan langsung berlaku.`
              : `Akses cabang ${editUser.name} diubah menjadi ${form.branchIds.length} cabang.`,
            successMsg: 'Akun diperbarui',
          });
        } else {
          await apiFetch(`/api/admin/users/${editUser.id}`, {
            method: 'PUT',
            json: payload,
          });
          toast.success('Akun diperbarui');
          setFormOpen(false);
          await load();
        }
      } else {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          json: {
            name: form.name.trim(),
            username: form.username.trim(),
            initialPin: form.initialPin,
            role: form.role,
            branchIds: form.branchIds,
          },
        });
        toast.success('Akun berhasil dibuat.');
        setFormOpen(false);
        await load();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan akun');
    } finally {
      setSaving(false);
    }
  };

  const runSensitive = async (v: SensitiveActionValues) => {
    if (!job) return;
    setJobLoading(true);
    setJobError(null);
    try {
      if (job.kind === 'user-update') {
        await apiFetch(`/api/admin/users/${job.user.id}`, {
          method: 'PUT',
          json: { ...job.payload, reason: v.reason, pin: v.pin },
        });
        toast.success(job.successMsg);
      } else if (job.kind === 'reset-pin') {
        await apiFetch(`/api/admin/users/${job.user.id}/reset-pin`, {
          method: 'POST',
          json: { reason: v.reason, pin: v.pin, newPin: v.newPin },
        });
        toast.success(
          `PIN ${job.user.name} berhasil direset.`
        );
      } else if (job.kind === 'unlock') {
        await apiFetch(`/api/admin/users/${job.user.id}/unlock`, {
          method: 'POST',
          json: { reason: v.reason, pin: v.pin },
        });
        toast.success(`Kunci akun ${job.user.name} dibuka`);
      } else {
        await apiFetch(`/api/admin/users/${job.user.id}/force-logout`, {
          method: 'POST',
          json: { reason: v.reason, pin: v.pin },
        });
        toast.success(`Seluruh sesi ${job.user.name} dicabut`);
      }
      setJob(null);
      await load();
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Gagal memproses aksi');
    } finally {
      setJobLoading(false);
    }
  };

  const jobTitle = !job
    ? ''
    : job.kind === 'user-update'
      ? 'Ubah Peran / Akses Cabang'
      : job.kind === 'reset-pin'
        ? 'Reset PIN User'
        : job.kind === 'unlock'
          ? 'Buka Kunci Akun'
          : 'Paksa Logout';

  const jobImpact = !job
    ? ''
    : job.kind === 'user-update'
      ? job.impact
      : job.kind === 'reset-pin'
        ? `PIN ${job.user.name} akan diganti menjadi PIN baru. Semua sesi lama tetap berlaku.`
        : job.kind === 'unlock'
          ? `Percobaan PIN gagal ${job.user.name} direset dan akun bisa dipakai login lagi.`
          : `Seluruh sesi aktif ${job.user.name} dicabut. Ia harus login ulang.`;

  const isLocked = (u: AdminUser) =>
    !!u.lockedUntil && new Date(u.lockedUntil) > new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Akun</h1>
          <p className="text-xs text-ink-muted">
            Kelola petugas & admin, akses cabang, dan aksi akun
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tambah Akun
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Akses Cabang</TableHead>
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
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-ink-muted">
                  Belum ada akun
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.mustChangePin && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-warning">
                      belum ganti PIN
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {u.role === 'admin' ? 'Admin' : 'Petugas'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-52 text-xs text-ink-muted">
                  {u.branches.length > 0 ? u.branches.map((b) => b.name).join(', ') : '—'}
                </TableCell>
                <TableCell>
                  {!u.isActive ? (
                    <Badge variant="secondary">Nonaktif</Badge>
                  ) : isLocked(u) ? (
                    <Badge variant="destructive">Terkunci</Badge>
                  ) : (
                    <Badge>Aktif</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Aksi
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(u)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Ubah nama / peran / akses
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setJobError(null);
                          setJob({ kind: 'reset-pin', user: u });
                        }}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Reset PIN
                      </DropdownMenuItem>
                      {isLocked(u) && (
                        <DropdownMenuItem
                          onClick={() => {
                            setJobError(null);
                            setJob({ kind: 'unlock', user: u });
                          }}
                        >
                          <LockOpen className="mr-2 h-4 w-4" />
                          Buka kunci akun
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setJobError(null);
                          setJob({ kind: 'force-logout', user: u });
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Paksa logout semua sesi
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setJobError(null);
                          setJob({
                            kind: 'user-update',
                            user: u,
                            payload: { isActive: !u.isActive },
                            impact: u.isActive
                              ? `${u.name} tidak akan bisa login lagi dan seluruh sesinya otomatis tidak berlaku. Riwayat tetap tersimpan.`
                              : `${u.name} dapat login kembali.`,
                            successMsg: u.isActive
                              ? `${u.name} dinonaktifkan`
                              : `${u.name} diaktifkan`,
                          });
                        }}
                        className="text-error focus:text-error"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        {u.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Ubah Akun' : 'Tambah Akun'}</DialogTitle>
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
              <Label htmlFor="user-name">
                Nama <span className="text-error">*</span>
              </Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Rina Wulandari"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-username">
                Username <span className="text-error">*</span>
              </Label>
              <Input
                id="user-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="rina"
                disabled={!!editUser}
                autoComplete="off"
                required
              />
              {editUser && (
                <p className="text-[11px] text-ink-light">Username tidak dapat diubah</p>
              )}
            </div>
            {!editUser && (
              <div className="space-y-1">
                <Label htmlFor="user-pin">
                  PIN Awal (6 digit) <span className="text-error">*</span>
                </Label>
                <Input
                  id="user-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.initialPin}
                  onChange={(e) =>
                    setForm({ ...form, initialPin: e.target.value.replace(/\D/g, '') })
                  }
                  placeholder="6 digit angka"
                  autoComplete="off"
                />
                <p className="text-[11px] text-ink-light">
                  User dapat menggantinya setelah login
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label>
                Peran <span className="text-error">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger aria-label="Pilih peran">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petugas">Petugas</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>
                Akses Cabang <span className="text-error">*</span>
              </Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    className="flex h-11 cursor-pointer items-center gap-3 border-b border-border px-3 text-sm last:border-b-0 hover:bg-canvas"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ink"
                      checked={form.branchIds.includes(b.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          branchIds: e.target.checked
                            ? [...form.branchIds, b.id]
                            : form.branchIds.filter((id) => id !== b.id),
                        })
                      }
                    />
                    {b.name}
                  </label>
                ))}
                {branches.length === 0 && (
                  <p className="p-3 text-xs text-ink-muted">Belum ada cabang</p>
                )}
              </div>
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

      <SensitiveActionDialog
        open={job !== null}
        onOpenChange={(o) => {
          if (!o) setJob(null);
        }}
        title={jobTitle}
        impact={jobImpact}
        confirmLabel="Konfirmasi"
        loading={jobLoading}
        error={jobError}
        withNewPin={job?.kind === 'reset-pin'}
        onSubmit={runSensitive}
      />
    </div>
  );
}


