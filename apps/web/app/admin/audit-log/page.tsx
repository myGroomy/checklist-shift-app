'use client';

import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Filter, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { apiFetch } from '@/lib/admin/api';

interface AuditLogRow {
  id: string;
  seq: number;
  at: string;
  actorId: string | null;
  actorName: string | null;
  actorUsername: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  branchId: string | null;
  branchName: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
}

interface FilterState {
  actorId: string;
  action: string;
  branchId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterState = {
  actorId: '',
  action: '',
  branchId: '',
  from: '',
  to: '',
};

const ALL = 'semua';

function buildQuery(f: FilterState, cursor: number | null): string {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (f.actorId) params.set('actorId', f.actorId);
  if (f.action.trim()) params.set('action', f.action.trim());
  if (f.branchId) params.set('branchId', f.branchId);
  if (f.from) params.set('from', `${f.from}T00:00:00`);
  if (f.to) params.set('to', `${f.to}T23:59:59`);
  if (cursor !== null) params.set('cursor', String(cursor));
  return `/api/admin/audit-log?${params.toString()}`;
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const load = async (f: FilterState) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ logs: AuditLogRow[]; nextCursor: number | null }>(
        buildQuery(f, null)
      );
      setLogs(data.logs);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // muat opsi filter sekali
    (async () => {
      try {
        const [u, b] = await Promise.all([
          apiFetch<{ users: { id: string; name: string }[] }>('/api/admin/users'),
          apiFetch<{ branches: { id: string; name: string }[] }>('/api/admin/branches'),
        ]);
        setUsers(u.users);
        setBranches(b.branches);
      } catch {
        // opsi filter bersifat pelengkap; kegagalan tidak menghalangi tabel
      }
    })();
  }, []);

  const loadMore = async () => {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<{ logs: AuditLogRow[]; nextCursor: number | null }>(
        buildQuery(filters, nextCursor)
      );
      setLogs((prev) => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat data berikutnya');
    } finally {
      setLoadingMore(false);
    }
  };

  const applyFilters = () => load(filters);
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Audit Log</h1>
        <p className="text-xs text-ink-muted">
          Append-only dan berantai hash — hanya bisa dibaca, tidak bisa diubah
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label>Pelaku</Label>
          <Select
            value={filters.actorId || ALL}
            onValueChange={(v) => setFilters({ ...filters, actorId: v === ALL ? '' : v })}
          >
            <SelectTrigger aria-label="Filter pelaku">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua pelaku</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-action">Aksi</Label>
          <Input
            id="audit-action"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            placeholder="mis. login_success"
          />
        </div>
        <div className="space-y-1">
          <Label>Cabang</Label>
          <Select
            value={filters.branchId || ALL}
            onValueChange={(v) => setFilters({ ...filters, branchId: v === ALL ? '' : v })}
          >
            <SelectTrigger aria-label="Filter cabang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua cabang</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-from">Dari tanggal</Label>
          <Input
            id="audit-from"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to">Sampai tanggal</Label>
          <Input
            id="audit-to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <Button onClick={applyFilters} disabled={loading}>
            <Search className="h-4 w-4" />
            Terapkan
          </Button>
          <Button variant="outline" onClick={resetFilters}>
            <Filter className="h-4 w-4" />
            Atur ulang
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Pelaku</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Objek</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-ink-muted">
                  Memuat...
                </TableCell>
              </TableRow>
            )}
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-ink-muted">
                  Tidak ada data
                </TableCell>
              </TableRow>
            )}
            {logs.map((row) => (
              <Fragment key={row.id}>
                <TableRow>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(row.at).toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.actorName ?? '—'}
                    {row.actorUsername && (
                      <span className="block font-mono text-[10px] text-ink-light">
                        {row.actorUsername}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {row.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-[11px] text-ink-muted">
                    {row.objectType}
                    {row.objectId ? `:${row.objectId.slice(-8)}` : ''}
                  </TableCell>
                  <TableCell className="text-xs">{row.branchName ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={expandedId === row.id}
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      {expandedId === row.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {expandedId === row.id ? 'Tutup' : 'Buka'}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === row.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-canvas p-4">
                      {row.reason && (
                        <p className="mb-2 text-xs">
                          <span className="font-semibold">Alasan:</span> {row.reason}
                        </p>
                      )}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase text-ink-muted">
                            Sebelum
                          </p>
                          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface p-2 text-[11px]">
                            {row.before !== null ? JSON.stringify(row.before, null, 2) : '—'}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase text-ink-muted">
                            Sesudah
                          </p>
                          <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface p-2 text-[11px]">
                            {row.after !== null ? JSON.stringify(row.after, null, 2) : '—'}
                          </pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {nextCursor !== null && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Memuat...' : 'Muat lebih banyak'}
          </Button>
        </div>
      )}
    </div>
  );
}

