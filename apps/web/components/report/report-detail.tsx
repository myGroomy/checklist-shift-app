'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Snapshot } from '@/lib/db/snapshot';
import { PublicReportView, type PublicReportViewData } from '@/components/report/public-report-view';

interface ReportResponse {
  report: {
    id: string;
    report_number: string;
    generated_at: string;
    is_locked: boolean;
    archive_pdf_drive_url: string | null;
    archived_photo_count: number | null;
  };
  shift: {
    branch_id: string;
    branch_name: string;
    branch_code: string;
    shift_date: string;
    status: string;
    pj_user_id: string;
    pj_name: string | null;
    opened_at: string;
    closed_at: string | null;
    template_snapshot: Snapshot;
  };
  handover: {
    values: unknown;
    freeText: string | null;
    submittedAt: string;
  } | null;
  incidents: Array<{
    id: string;
    categoryName: string;
    description: string;
    status: string;
    occurredAt: string;
  }>;
  entries: Array<{
    pointRef: string;
    state: 'belum' | 'selesai' | 'skip';
    value: string | null;
    skipReason: string | null;
    timingLabel: string | null;
    completedByName: string | null;
    completedAt: string | null;
  }>;
  participants: Array<{ id: string; name: string; isPj: boolean; itemsDone: number }>;
  addenda: Array<{ id: string; note: string; authorName: string; createdAt: string }>;
}

export function ReportDetail({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PublicReportViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          next: { revalidate: 30 },
          headers: { 'X-Requested-With': 'fetch' },
        });
        const result = (await response.json()) as ReportResponse & { error?: string };
        if (!response.ok) throw new Error(result.error || 'Laporan tidak dapat dimuat.');

        setData({
          branch: { name: result.shift.branch_name, code: result.shift.branch_code },
          shift: {
            shiftDate: result.shift.shift_date,
            status: result.shift.status,
            openedAt: new Date(result.shift.opened_at),
            closedAt: result.shift.closed_at ? new Date(result.shift.closed_at) : null,
            pjName: result.shift.pj_name,
            snapshot: result.shift.template_snapshot,
          },
          report: {
            reportNumber: result.report.report_number,
            generatedAt: new Date(result.report.generated_at),
            isLocked: result.report.is_locked,
            archivePdfDriveUrl: result.report.archive_pdf_drive_url,
            archivedPhotoCount: result.report.archived_photo_count,
          },
          entries: result.entries.map((entry) => ({
            ...entry,
            completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
          })),
          participants: result.participants,
          handover: result.handover
            ? { ...result.handover, submittedAt: new Date(result.handover.submittedAt) }
            : null,
          incidents: result.incidents.map((incident) => ({
            ...incident,
            occurredAt: new Date(incident.occurredAt),
          })),
          addenda: result.addenda.map((item) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          })),
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Laporan tidak dapat dimuat.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [reportId]);

  if (loading) {
    return <main className="mx-auto max-w-5xl p-4"><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Memuat laporan…</div></main>;
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <Button type="button" variant="outline" onClick={() => router.push('/report')}><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke laporan</Button>
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error ?? 'Laporan tidak ditemukan.'}
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4 md:px-8 print:hidden">
        <Button asChild type="button" variant="outline">
          <Link href="/report"><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke laporan</Link>
        </Button>
      </div>
      <PublicReportView data={data} showCopyLink={false} />
    </>
  );
}
