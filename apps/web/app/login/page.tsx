'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username wajib diisi');
      return;
    }
    if (pin.length !== 6) {
      setError('PIN harus 6 digit angka');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({ username: username.trim(), pin }),
      });

      const data = (await res.json()) as {
        error?: string;
        user?: { mustChangePin?: boolean };
      };

      if (!res.ok) {
        setError(data.error || 'Login gagal. Periksa username dan PIN Anda.');
        setPin('');
        return;
      }

      if (data.user?.mustChangePin) {
        router.push('/ganti-pin');
      } else {
        router.push(from);
      }
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="username" className="block text-xs font-medium text-ink-muted mb-1">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername((e.target as HTMLInputElement).value)}
          placeholder="Masukkan username"
          autoComplete="username"
          className="w-full h-12 rounded-lg border border-border bg-canvas px-3 text-sm text-ink focus:border-ink focus:outline-none"
          required
        />
      </div>

      <div className="mb-5">
        <label className="block text-xs font-medium text-ink-muted mb-2">
          PIN (6 Digit) <span className="text-red-500">*</span>
        </label>

        {/* Display Indicator 6 Dots */}
        <div className="flex justify-center gap-2 mb-4">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-10 w-10 rounded-lg border flex items-center justify-center text-lg font-bold transition-all ${
                idx < pin.length
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-border bg-canvas text-ink-light'
              }`}
            >
              {idx < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        {/* Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeypadPress(num)}
              className="h-12 rounded-lg border border-border bg-surface text-base font-semibold text-ink active:bg-canvas hover:bg-canvas transition-colors flex items-center justify-center touch-manipulation"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-lg border border-border bg-surface text-xs font-medium text-ink-muted active:bg-canvas transition-colors flex items-center justify-center touch-manipulation"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="h-12 rounded-lg border border-border bg-surface text-base font-semibold text-ink active:bg-canvas hover:bg-canvas transition-colors flex items-center justify-center touch-manipulation"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-lg border border-border bg-surface text-xs font-medium text-ink-muted active:bg-canvas transition-colors flex items-center justify-center touch-manipulation"
          >
            ⌫
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || pin.length !== 6 || !username.trim()}
        className="w-full h-12 rounded-lg bg-ink text-canvas font-semibold text-sm disabled:opacity-50 transition-opacity flex items-center justify-center"
      >
        {loading ? 'Memproses...' : 'Masuk'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 bg-canvas text-ink">
      <div className="w-full max-w-sm">
        {/* Logo & Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-ink text-canvas">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">checklist-shift</h1>
          <p className="mt-1 text-xs text-ink-muted">Masuk untuk memulai shift Anda</p>
        </div>

        <Suspense fallback={<div className="text-center text-xs text-ink-muted">Memuat...</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-ink-light">v2.0 — Supabase PostgreSQL</p>
      </div>
    </main>
  );
}
