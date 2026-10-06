'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'pwa-install-dismissed';

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
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

  useEffect(() => {
    if (!deferredPrompt) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === 'true') return;

    const timer = setTimeout(() => {
      toast('Biar lebih cepat diakses tanpa buka browser, yuk install aplikasinya!', {
        duration: Infinity,
        action: {
          label: 'Pasang',
          onClick: () => void installApp(),
        },
        cancel: {
          label: 'Nanti',
          onClick: () => {},
        },
        closeButton: false,
        onDismiss: () => {},
        actionButtonStyle: {
          backgroundColor: '#047857',
          color: '#fff',
        },
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [deferredPrompt]);

  const installApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const dismissPermanently = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    toast.dismiss();
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
      {deferredPrompt && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <p className="text-sm text-ink">Install aplikasi untuk akses lebih cepat?</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void installApp()}>
              Pasang
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => toast.dismiss()}>
              Nanti
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={dismissPermanently}>
              Jangan tampilkan lagi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
