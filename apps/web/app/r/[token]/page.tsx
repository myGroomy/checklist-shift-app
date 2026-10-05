import { createHash } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';
import { db } from '@/lib/db';
import { branches, handovers, incidents, reports, shareTokens, shiftInstances } from '@/drizzle/schema';

export default async function PublicReportPage({
  params,
}: {
  params: { token: string };
}) {
  const rawToken = params.token;
  const hash = createHash('sha256').update(rawToken).digest('hex');

  const [share] = await db
    .select({
      id: shareTokens.id,
      reportId: shareTokens.reportId,
      shiftInstanceId: shareTokens.shiftInstanceId,
      branchId: shareTokens.branchId,
      expiresAt: shareTokens.expiresAt,
      revokedAt: shareTokens.revokedAt,
    })
    .from(shareTokens)
    .where(and(eq(shareTokens.secretHash, hash), isNull(shareTokens.revokedAt)))
    .limit(1);

  if (!share) {
    return <PublicState title="Tautan laporan tidak valid" description="Tautan ini tidak aktif, sudah dicabut, atau sudah tidak berlaku." tone="warn" />;
  }

  if (new Date(share.expiresAt) < new Date()) {
    return <PublicState title="Tautan laporan kedaluwarsa" description="Tautan ini sudah kedaluwarsa dan tidak dapat dibuka lagi." tone="warn" />;
  }

  const [report] = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      generatedAt: reports.generatedAt,
      summaryStats: reports.summaryStats,
      isLocked: reports.isLocked,
    })
    .from(reports)
    .where(eq(reports.id, share.reportId))
    .limit(1);

  if (!report) {
    return <PublicState title="Laporan tidak ditemukan" description="Data laporan tidak ditemukan di sistem." tone="warn" />;
  }

  const [shift] = await db
    .select({
      id: shiftInstances.id,
      shiftDate: shiftInstances.shiftDate,
      status: shiftInstances.status,
      branchId: shiftInstances.branchId,
      openedAt: shiftInstances.openedAt,
    })
    .from(shiftInstances)
    .where(eq(shiftInstances.id, share.shiftInstanceId))
    .limit(1);

  const [branch] = await db
    .select({
      id: branches.id,
      name: branches.name,
      code: branches.code,
    })
    .from(branches)
    .where(eq(branches.id, share.branchId))
    .limit(1);

  const [handover] = await db
    .select({
      id: handovers.id,
      freeText: handovers.freeText,
      values: handovers.values,
      submittedAt: handovers.submittedAt,
    })
    .from(handovers)
    .where(eq(handovers.shiftInstanceId, share.shiftInstanceId))
    .limit(1);

  const incidentRows = await db
    .select({
      id: incidents.id,
      description: incidents.description,
      status: incidents.status,
      occurredAt: incidents.occurredAt,
    })
    .from(incidents)
    .where(eq(incidents.shiftInstanceId, share.shiftInstanceId));

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-muted">
              Laporan publik
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              {branch?.name ?? 'Cabang'} — {report.reportNumber}
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {report.isLocked ? 'Terkunci' : 'Terbuka'}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Cabang" value={branch?.name ?? '-'} />
          <Stat label="Tanggal shift" value={shift?.shiftDate ? new Date(`${shift.shiftDate}T00:00:00`).toLocaleDateString('id-ID') : '-'} />
          <Stat label="Dibuat" value={report.generatedAt ? new Date(report.generatedAt).toLocaleString('id-ID') : '-'} />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-canvas p-4">
          <h2 className="text-base font-semibold">Ringkasan</h2>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-ink-muted">
            {report.summaryStats ? JSON.stringify(report.summaryStats, null, 2) : 'Belum ada ringkasan.'}
          </pre>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border bg-canvas p-4">
            <h2 className="text-base font-semibold">Handover</h2>
            <div className="mt-3 space-y-3 text-sm text-ink-muted">
              {handover ? (
                <>
                  {handover.values && Object.keys(handover.values as Record<string, unknown>).length > 0 ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(handover.values, null, 2)}
                    </pre>
                  ) : null}
                  {handover.freeText ? <p>{handover.freeText}</p> : <p>Tidak ada catatan handover.</p>}
                </>
              ) : (
                <p>Belum ada handover yang dikirim.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-canvas p-4">
            <h2 className="text-base font-semibold">Incident</h2>
            <div className="mt-3 space-y-3 text-sm text-ink-muted">
              {incidentRows.length > 0 ? (
                incidentRows.map((incident) => (
                  <div key={incident.id} className="rounded-lg border border-border bg-surface p-3">
                    <p className="font-medium text-ink">{incident.status === 'open' ? 'Open' : 'Selesai'}</p>
                    <p className="mt-1">{incident.description}</p>
                    {incident.occurredAt && (
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {new Date(incident.occurredAt).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p>Tidak ada incident tercatat.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function PublicState({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: 'warn';
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          {tone === 'warn' ? <AlertCircle className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{description}</p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className="mt-2 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}
