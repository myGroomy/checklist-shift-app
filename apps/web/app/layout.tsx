import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { PwaStatus } from '@/components/pwa-status';
import './globals.css';

export const metadata: Metadata = {
  title: 'checklist-shift',
  description: 'PWA untuk SOP shift karyawan F&B',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'checklist-shift',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#292524',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-canvas text-ink antialiased">
        <PwaStatus />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
