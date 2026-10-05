'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/admin/api';

interface IncidentCategory {
  id: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: string;
}

export default function KategoriIncidentPage() {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ categories: IncidentCategory[] }>(
        '/api/admin/incident-categories'
      );
      setCategories(data.categories);
      setEdits({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length < 2) {
      toast.error('Nama kategori minimal 2 karakter');
      return;
    }
    setAdding(true);
    try {
      await apiFetch('/api/admin/incident-categories', {
        method: 'POST',
        json: { name: newName.trim() },
      });
      toast.success('Kategori ditambahkan');
      setNewName('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambah kategori');
    } finally {
      setAdding(false);
    }
  };

  const saveCategory = async (c: IncidentCategory) => {
    const name = (edits[c.id] ?? c.name).trim();
    if (name.length < 2) {
      toast.error('Nama kategori minimal 2 karakter');
      return;
    }
    setSavingId(c.id);
    try {
      await apiFetch(`/api/admin/incident-categories/${c.id}`, {
        method: 'PUT',
        json: { name },
      });
      toast.success('Kategori diperbarui');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui kategori');
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (c: IncidentCategory) => {
    try {
      await apiFetch(`/api/admin/incident-categories/${c.id}`, {
        method: 'PUT',
        json: { isActive: !c.isActive },
      });
      toast.success(c.isActive ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Kategori Incident</h1>
        <p className="text-xs text-ink-muted">
          Kategori dipakai pada form incident petugas
        </p>
      </div>

      <form
        onSubmit={addCategory}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Kategori baru (mis. Kebersihan)"
          className="max-w-xs flex-1"
          aria-label="Nama kategori baru"
        />
        <Button type="submit" disabled={adding}>
          <Plus className="h-4 w-4" />
          {adding ? 'Menambah...' : 'Tambah'}
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-surface">
        {loading && <p className="p-4 text-sm text-ink-muted">Memuat...</p>}
        {!loading && categories.length === 0 && (
          <p className="p-4 text-sm text-ink-muted">Belum ada kategori</p>
        )}
        {!loading &&
          categories.map((c) => {
            const value = edits[c.id] ?? c.name;
            const dirty = value !== c.name;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 border-b border-border p-3 last:border-b-0"
              >
                <Input
                  value={value}
                  onChange={(e) => setEdits({ ...edits, [c.id]: e.target.value })}
                  className="max-w-xs flex-1"
                  aria-label={`Nama kategori ${c.name}`}
                />
                <Badge variant={c.isActive ? 'default' : 'secondary'}>
                  {c.isActive ? 'Aktif' : 'Nonaktif'}
                </Badge>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!dirty || savingId === c.id}
                    onClick={() => saveCategory(c)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {savingId === c.id ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                  {dirty && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEdits({ ...edits, [c.id]: c.name })}
                    >
                      <X className="h-3.5 w-3.5" />
                      Batal
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => toggleActive(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                    {c.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
