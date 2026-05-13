'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { toast } from 'sonner';

interface Row {
  id: string;
  user_id: string;
  amount_usd: number;
  status: 'pending' | 'approved' | 'rejected';
  user_note: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const FILTERS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
] as const;

const PAGE_SIZE = 20;

export function AdminDepositsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('deposit_requests')
        .select('id, user_id, amount_usd, status, user_note, admin_note, reviewed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (active) {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      }
    })();

    const channelName = `admin-deposits-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deposit_requests' },
        (msg) => {
          const row = (msg.new ?? msg.old) as Row;
          setRows((prev) => {
            if (msg.eventType === 'INSERT') return [row, ...prev];
            if (msg.eventType === 'UPDATE') return prev.map((r) => (r.id === row.id ? row : r));
            if (msg.eventType === 'DELETE') return prev.filter((r) => r.id !== row.id);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function review(id: string, action: 'approve' | 'reject', note?: string) {
    setBusyId(id);
    const res = await fetch(`/api/deposits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_note: note }),
    });
    setBusyId(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      toast.error(error ?? 'Failed');
      return;
    }
    toast.success(action === 'approve' ? 'Approved' : 'Rejected');
  }

  function changeFilter(v: string) {
    setFilter(v);
    setPage(0);
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                {rows.filter((r) => r.status === f.value).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Note</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    No requests in this filter.
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {r.user_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    ${r.amount_usd.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                    {r.user_note ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        r.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : r.status === 'approved'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === 'pending' ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          onClick={() => review(r.id, 'approve')}
                          disabled={busyId === r.id}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const note = prompt('Reject reason (optional):') ?? undefined;
                            review(r.id, 'reject', note);
                          }}
                          disabled={busyId === r.id}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.reviewed_at
                          ? formatDistanceToNow(new Date(r.reviewed_at), { addSuffix: true })
                          : '-'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
