'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { apiFetch } from '@/lib/admin/api';

interface Setting {
  key: string;
  value: string;
  valueType: 'int' | 'bool' | 'string' | 'text';
}

interface FieldDef {
  key: string;
  label: string;
  hint?: string;
}

const GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Waktu & Toleransi',
    fields: [
      { key: 'tolerance_default_minutes', label: 'Toleransi baku item (menit)' },
      {
        key: 'incident_link_window_hours',
        label: 'Jendela tautan incident setelah shift (jam)',
      },
    ],
  },
  {
    title: 'PIN & Sesi',
    fields: [
      { key: 'pin_max_attempts', label: 'Maks percobaan PIN salah' },
      { key: 'pin_lock_minutes', label: 'Durasi kunci akun (menit)' },
      { key: 'pin_block_weak', label: 'Blokir PIN lemah' },
      { key: 'session_days', label: 'Masa berlaku sesi (hari)' },
      { key: 'share_token_days', label: 'Masa berlaku tautan publik (hari)' },
    ],
  },
  {
    title: 'Foto',
    fields: [
      { key: 'photo_max_count', label: 'Maks foto per incident' },
      { key: 'photo_max_size_kb', label: 'Ukuran foto maks (KB)' },
      {
        key: 'photo_retention_days',
        label: 'Retensi foto (hari)',
        hint: '0 = mengikuti arsip mingguan',
      },
      { key: 'public_show_photos', label: 'Tampilkan foto di laporan publik' },
    ],
  },
  {
    title: 'Template WhatsApp',
    fields: [
      {
        key: 'whatsapp_template',
        label: 'Template pesan berbagi laporan',
        hint: 'Variabel: {cabang} {tanggal} {shift} {pj} {ringkasan} {tautan}',
      },
    ],
  },
];

const PREVIEW_SAMPLE: Record<string, string> = {
  '{cabang}': 'Bandung Pusat',
  '{tanggal}': '05 Okt 2026',
  '{shift}': 'Opening',
  '{pj}': 'Rina',
  '{ringkasan}': '20/20 item, 0 incident',
  '{tautan}': 'https://app.example.id/r/abc123',
};

function previewTemplate(tpl: string): string {
  return Object.entries(PREVIEW_SAMPLE).reduce(
    (acc, [k, v]) => acc.split(k).join(v),
    tpl
  );
}

export default function PengaturanPage() {
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ settings: Setting[] }>('/api/admin/settings');
      const map: Record<string, Setting> = {};
      data.settings.forEach((s) => {
        map[s.key] = s;
      });
      setSettings(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as Setting), value },
    }));
  };

  const handleSave = async () => {
    // Validasi sederhana di klien
    for (const g of GROUPS) {
      for (const f of g.fields) {
        const s = settings[f.key];
        if (!s) continue;
        if (s.valueType === 'int' && !/^\d+$/.test(s.value)) {
          toast.error(`${f.label} harus berupa angka`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = Object.values(settings).map((s) => ({
        key: s.key,
        value: s.value,
      }));
      await apiFetch('/api/admin/settings', { method: 'PUT', json: { settings: payload } });
      toast.success('Pengaturan disimpan');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pengaturan</h1>
          <p className="text-xs text-ink-muted">
            Berlaku untuk seluruh cabang kecuali disebut lain
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          <Save className="h-4 w-4" />
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </Button>
      </div>

      {loading && <p className="text-sm text-ink-muted">Memuat...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((g) => (
          <Card key={g.title}>
            <CardHeader>
              <CardTitle className="text-sm">{g.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {g.fields.map((f) => {
                const s = settings[f.key];
                if (!s) return null;
                return (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={`set-${f.key}`}>{f.label}</Label>
                    {s.valueType === 'bool' ? (
                      <Select
                        value={s.value}
                        onValueChange={(v) => setValue(f.key, v)}
                      >
                        <SelectTrigger id={`set-${f.key}`} aria-label={f.label}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TRUE">Aktif (TRUE)</SelectItem>
                          <SelectItem value="FALSE">Nonaktif (FALSE)</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : s.valueType === 'text' || s.key === 'whatsapp_template' ? (
                      <Textarea
                        id={`set-${f.key}`}
                        value={s.value}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={`set-${f.key}`}
                        value={s.value}
                        inputMode="numeric"
                        onChange={(e) => setValue(f.key, e.target.value.replace(/[^\d-]/g, ''))}
                      />
                    )}
                    {f.hint && <p className="text-[11px] text-ink-light">{f.hint}</p>}
                    {f.key === 'whatsapp_template' && (
                      <div className="rounded-lg border border-border bg-canvas p-3 text-xs">
                        <span className="mb-1 block font-semibold uppercase tracking-wide text-ink-muted">
                          Pratinjau
                        </span>
                        {previewTemplate(s.value)}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

