import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { branches, incidents, reports, shiftDefinitions, shiftInstances } from '@/drizzle/schema';

export default async function AdminIndex() {
  const ctx = await requireAdmin();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [branchTotal, activeShiftCount, openIncidentCount, reportsTodayCount, branchStats, alerts] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(branches)
        .where(eq(branches.isActive, true)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(shiftInstances)
        .where(eq(shiftInstances.status, 'berjalan')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(eq(incidents.status, 'open')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(gte(reports.generatedAt, todayStart)),
      db
        .select({
          id: branches.id,
          name: branches.name,
          code: branches.code,
          activeShifts: sql<number>`COALESCE((SELECT COUNT(*) FROM shift_instances si WHERE si.branch_id = "branches"."id" AND si.status = 'berjalan'), 0)`,
          openIncidents: sql<number>`COALESCE((SELECT COUNT(*) FROM incidents i WHERE i.branch_id = "branches"."id" AND i.status = 'open'), 0)`,
          reportsToday: sql<number>`COALESCE((SELECT COUNT(*) FROM reports r JOIN shift_instances si ON si.id = r.shift_instance_id WHERE si.branch_id = "branches"."id" AND r.generated_at >= ${todayStart.toISOString()}::timestamptz), 0)`,
        })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name),
      db
        .select({
          branchName: branches.name,
          shiftName: shiftDefinitions.name,
          openedAt: shiftInstances.openedAt,
          pjName: sql<string>`(SELECT u.name FROM users u WHERE u.id = ${shiftInstances.pjUserId})`,
        })
        .from(shiftInstances)
        .leftJoin(reports, eq(shiftInstances.id, reports.shiftInstanceId))
        .leftJoin(branches, eq(shiftInstances.branchId, branches.id))
        .leftJoin(shiftDefinitions, eq(shiftInstances.shiftDefinitionId, shiftDefinitions.id))
        .where(and(eq(shiftInstances.status, 'berjalan'), isNull(reports.id)))
        .orderBy(desc(shiftInstances.openedAt))
        .limit(8),
    ]);

  const stats = {
    branches: Number(branchTotal[0]?.count ?? 0),
    activeShifts: Number(activeShiftCount[0]?.count ?? 0),
    openIncidents: Number(openIncidentCount[0]?.count ?? 0),
    reportsToday: Number(reportsTodayCount[0]?.count ?? 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Admin • {ctx.user.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold">Dasbor</h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cabang aktif" value={stats.branches} helper="Total cabang" />
        <MetricCard label="Shift berjalan" value={stats.activeShifts} helper="Dalam proses" />
        <MetricCard label="Incident terbuka" value={stats.openIncidents} helper="Perlu tindak lanjut" />
        <MetricCard label="Laporan hari ini" value={stats.reportsToday} helper="Generate otomatis" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Ringkasan per cabang</h2>
          </div>
          <div className="space-y-3">
            {branchStats.map((branch) => (
              <div key={branch.id} className="rounded-lg border border-border bg-canvas p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-ink-muted">{branch.code}</p>
                  </div>
                  <div className="flex gap-2 text-xs text-ink-muted">
                    <span className="rounded-full border border-border px-2 py-1">{Number(branch.activeShifts)} jalan</span>
                    <span className="rounded-full border border-border px-2 py-1">{Number(branch.openIncidents)} incident</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-surface p-2">
                    <div className="text-ink-muted">Shift</div>
                    <div className="mt-1 text-base font-semibold">{Number(branch.activeShifts)}</div>
                  </div>
                  <div className="rounded-md bg-surface p-2">
                    <div className="text-ink-muted">Report</div>
                    <div className="mt-1 text-base font-semibold">{Number(branch.reportsToday)}</div>
                  </div>
                  <div className="rounded-md bg-surface p-2">
                    <div className="text-ink-muted">Open</div>
                    <div className="mt-1 text-base font-semibold">{Number(branch.openIncidents)}</div>
                  </div>
                </div>
              </div>
            ))}
            {branchStats.length === 0 && (
              <p className="text-sm text-ink-muted">Belum ada cabang aktif.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Peringatan</h2>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-ink-muted">Tidak ada peringatan aktif.</p>
            ) : (
              alerts.map((alert, idx) => (
                <div key={`${alert.branchName}-${alert.shiftName}-${idx}`} className="rounded-lg border border-border bg-canvas p-3">
                  <p className="text-sm font-medium">{alert.branchName}</p>
                  <p className="mt-1 text-xs text-ink-muted">{alert.shiftName}</p>
                  <p className="mt-2 text-[11px] text-warning">
                    Shift berjalan sejak {alert.openedAt ? new Date(alert.openedAt).toLocaleString('id-ID') : '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-muted">PJ: {alert.pjName || '—'}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <div className="mt-3 text-3xl font-bold">{value}</div>
      <p className="mt-1 text-xs text-ink-muted">{helper}</p>
    </div>
  );
}
