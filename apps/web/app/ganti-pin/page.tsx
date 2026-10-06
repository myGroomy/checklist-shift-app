'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GantiPinPage() {
  const router = useRouter();

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (oldPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6) {
      setError('Setiap PIN harus terdiri dari 6 angka');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PIN baru dan Konfirmasi PIN tidak cocok');
      return;
    }

    if (oldPin === newPin) {
      setError('PIN baru harus berbeda dari PIN lama');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({ oldPin, newPin, confirmPin }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || 'Gagal mengubah PIN');
        return;
      }

      setSuccess('PIN berhasil diperbarui. Mengalihkan...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 bg-canvas text-ink">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Ganti PIN</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Perbarui PIN Anda untuk menjaga keamanan akun
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs font-medium text-green-700">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="oldPin" className="block text-xs font-medium text-ink-muted mb-1">
              PIN Lama / Awal (6 Digit) <span className="text-red-500">*</span>
            </label>
            <input
              id="oldPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={oldPin}
              onChange={(e) => setOldPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full h-12 rounded-lg border border-border bg-canvas px-3 text-center text-lg tracking-widest font-bold text-ink focus:border-ink focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="newPin" className="block text-xs font-medium text-ink-muted mb-1">
              PIN Baru (6 Digit) <span className="text-red-500">*</span>
            </label>
            <input
              id="newPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
              placeholder="======="
              className="w-full h-12 rounded-lg border border-border bg-canvas px-3 text-center text-lg tracking-widest font-bold text-ink focus:border-ink focus:outline-none"
              required
            />
            <p className="mt-1 text-[10px] text-ink-light">
              Gunakan 6 angka yang tidak mudah ditebak (bukan 123456/111111)
            </p>
          </div>

          <div>
            <label htmlFor="confirmPin" className="block text-xs font-medium text-ink-muted mb-1">
              Konfirmasi PIN Baru <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
              placeholder="======="
              className="w-full h-12 rounded-lg border border-border bg-canvas px-3 text-center text-lg tracking-widest font-bold text-ink focus:border-ink focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || oldPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6}
            className="w-full h-12 rounded-lg bg-ink text-canvas font-semibold text-sm disabled:opacity-50 transition-opacity flex items-center justify-center mt-2"
          >
            {loading ? 'Memperbarui...' : 'Simpan PIN Baru'}
          </button>
        </form>
      </div>
    </main>
  );
}
