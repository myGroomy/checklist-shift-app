import { createHash } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reports, shareTokens } from '@/drizzle/schema';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) {
    return NextResponse.json({ error: 'Token wajib disediakan.' }, { status: 400 });
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [share] = await db
    .select({
      id: shareTokens.id,
      reportId: shareTokens.reportId,
      branchId: shareTokens.branchId,
      shiftInstanceId: shareTokens.shiftInstanceId,
      expiresAt: shareTokens.expiresAt,
      revokedAt: shareTokens.revokedAt,
    })
    .from(shareTokens)
    .where(and(eq(shareTokens.secretHash, tokenHash), isNull(shareTokens.revokedAt)))
    .limit(1);

  if (!share) {
    return NextResponse.json({ error: 'Token laporan tidak valid atau sudah dicabut.' }, { status: 404 });
  }

  if (new Date(share.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Token laporan telah kedaluwarsa.' }, { status: 410 });
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
    return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    tokenId: share.id,
    report: {
      id: report.id,
      report_number: report.reportNumber,
      generated_at: report.generatedAt,
      is_locked: report.isLocked,
      summary_stats: report.summaryStats,
    },
    expires_at: share.expiresAt,
  });
}
