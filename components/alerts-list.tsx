'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface AlertRow {
  id: string;
  kind: string;
  chain: string | null;
  pair_address: string | null;
  payload: {
    symbol?: string;
    side?: string;
    amountUsd?: number;
    amountTokens?: number;
    signature?: string;
    buyer?: string;
    clusterCount?: number;
    clusterTotalUsd?: number;
    wallet?: string;
    label?: string | null;
  };
  created_at: string;
  read_at: string | null;
}

const PAGE_SIZE = 30;
const FILTERS = [
  { label: 'All', value: 'all' },
  { label: '🐋 Whale', value: 'whale_buy' },
  { label: '🟢 Cluster', value: 'cluster_buy' },
  { label: '👤 Wallet', value: 'wallet_activity' },
] as const;

export function AlertsList() {
  const [items, setItems] = useState<AlertRow[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      if (active) setLoading(true);
      let q = supabase
        .from('alerts')
        .select('id, kind, chain, pair_address, payload, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (filter !== 'all') q = q.eq('kind', filter);
      const { data } = await q;
      if (!active) return;
      const rows = (data ?? []) as AlertRow[];
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);

      const unreadIds = rows.filter((r) => !r.read_at).map((r) => r.id);
      if (unreadIds.length > 0) {
        await supabase
          .from('alerts')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
    })();
    return () => {
      active = false;
    };
  }, [filter]);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `alerts-page-${filter}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${user.id}`,
          },
          (msg) => {
            const row = msg.new as AlertRow;
            if (filter !== 'all' && row.kind !== filter) return;
            setItems((prev) => [row, ...prev]);
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [filter]);

  async function loadMore() {
    if (items.length === 0 || loadingMore) return;
    setLoadingMore(true);
    const supabase = createClient();
    const lastDate = items[items.length - 1].created_at;
    let q = supabase
      .from('alerts')
      .select('id, kind, chain, pair_address, payload, created_at, read_at')
      .lt('created_at', lastDate)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (filter !== 'all') q = q.eq('kind', filter);
    const { data } = await q;
    const rows = (data ?? []) as AlertRow[];
    setItems((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {items.length} {filter !== 'all' ? FILTERS.find((f) => f.value === filter)?.label.toLowerCase() : ''} alerts
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No alerts yet.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground sticky top-0 bg-card z-10 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Token</th>
                  <th className="px-4 py-3 text-right font-medium">USD</th>
                  <th className="px-4 py-3 text-left font-medium">Wallet</th>
                  <th className="px-4 py-3 text-left font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const usd = a.payload.amountUsd ?? 0;
                  const sig = a.payload.signature;
                  const isCluster = a.kind === 'cluster_buy';
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {isCluster ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-500">
                            🟢 cluster {a.payload.clusterCount ? `×${a.payload.clusterCount}` : ''}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                            🐋 whale
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {a.chain && a.pair_address ? (
                          <Link
                            href={`/coin/${a.chain}/${a.pair_address}`}
                            className="font-semibold hover:underline"
                          >
                            {a.payload.symbol ?? '-'}
                          </Link>
                        ) : (
                          <span className="font-semibold">{a.payload.symbol ?? '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        ${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {a.payload.buyer
                          ? `${a.payload.buyer.slice(0, 4)}...${a.payload.buyer.slice(-4)}`
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {sig ? (
                          <a
                            href={`https://solscan.io/tx/${sig}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline"
                          >
                            ↗
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-3 border-t flex justify-center">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
