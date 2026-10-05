import { Info } from 'lucide-react';

/**
 * BR-05: shift berjalan memakai snapshot template, jadi perubahan template
 * hanya berlaku untuk shift yang dibuka setelahnya.
 */
export function TemplateNotice({ className }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted ${className ?? ''}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        Perubahan template berlaku untuk shift yang dibuka setelah ini. Shift yang sedang
        berjalan memakai salinan template saat dibuka.
      </span>
    </p>
  );
}
