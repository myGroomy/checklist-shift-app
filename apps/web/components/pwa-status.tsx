'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowInstall(true);
    };

    const handleAppInstalled = () => {
      setShowInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations
                .filter((registration) => {
                  const scope = new URL(registration.scope);
                  return scope.origin === window.location.origin && scope.pathname === '/';
                })
                .map((registration) => registration.unregister())
            )
          )
          .catch((error: unknown) => console.error('Gagal membersihkan service worker development:', error));

        if ('caches' in window) {
          window.caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith('checklist-shift-'))
                  .map((key) => window.caches.delete(key))
              )
            )
            .catch((error: unknown) => console.error('Gagal membersihkan cache development:', error));
        }
      }
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {!isOnline && (
        <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Tidak ada koneksi. Beberapa fitur wajib online akan dinonaktifkan.
        </div>
      )}

      {showInstall && (
        <div className="sticky top-0 z-50 border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 sm:flex-row">
            <span>Biar lebih cepat diakses tanpa buka browser, yuk install aplikasinya!.</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={installApp}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-800"
              >
                Pasang
              </button>
              <button
                type="button"
                onClick={() => setShowInstall(false)}
                className="rounded-lg border border-emerald-700 px-3 py-1.5 font-semibold text-emerald-800"
              >
                Nanti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
