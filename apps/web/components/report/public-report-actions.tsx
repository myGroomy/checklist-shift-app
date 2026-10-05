'use client';

import { useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicReportActions({ showCopy = true }: { showCopy?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Salin tautan laporan ini:', window.location.href);
    }
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" />
        Cetak / Simpan PDF
      </Button>
      {showCopy && (
        <Button type="button" variant="outline" onClick={() => void copyLink()}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Tersalin' : 'Salin tautan'}
        </Button>
      )}
    </div>
  );
}
