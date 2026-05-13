'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 25;

interface Trade {
  id: string;
  chain: string;
  pair_address: string;
  token_symbol: string | null;
  signal_kind: string;
  entry_price: number;
  entry_amount_usd: number;
  entry_tokens: number;
  entry_at: string;
  exit_price: number | null;
  exit_at: string | null;
  exit_reason: string | null;
  pnl_usd: number | null;
  pnl_pct: number | null;
  status: 'open' | 'closed';
}

interface Event {
  id: string;
  type: 'buy' | 'sell';
  at: string;
  trade: Trade;
}

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: '🟢 Buys', value: 'buy' },
  { label: '🔴 Sells', value: 'sell' },
  { label: '🎯 Wins', value: 'win' },
  { label: '🛑 Losses', value: 'loss' },
] as const;

function usd(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function formatPrice(p: number) {
  if (p === 0) return '$0';
  if (p < 0.0001) return `$${p.toExponential(2)}`;
  if (p < 1) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(4)}`;
}

export function ActivityLog({ trades }: { trades: Trade[] }) {
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  function changeFilter(v: string) {
    setFilter(v);
    setPage(0);
  }

  const events: Event[] = [];
  for (const t of trades) {
    events.push({ id: `${t.id}-buy`, type: 'buy', at: t.entry_at, trade: t });
    if (t.status === 'closed' && t.exit_at) {
      events.push({ id: `${t.id}-sell`, type: 'sell', at: t.exit_at, trade: t });
    }
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const filtered = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'buy') return e.type === 'buy';
    if (filter === 'sell') return e.type === 'sell';
    if (filter === 'win') return e.type === 'sell' && (e.trade.pnl_usd ?? 0) > 0;
    if (filter === 'loss') return e.type === 'sell' && (e.trade.pnl_usd ?? 0) < 0;
    return true;
  });

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h2 className="font-semibold">Activity log</h2>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => changeFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Token</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">PnL</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const t = e.trade;
                const isBuy = e.type === 'buy';
                const isWin = !isBuy && (t.pnl_usd ?? 0) > 0;
                const isLoss = !isBuy && (t.pnl_usd ?? 0) < 0;

                let actionLabel: string;
                let actionColor: string;
                if (isBuy) {
                  actionLabel = '🟢 BUY';
                  actionColor = 'text-green-500';
                } else if (t.exit_reason === 'take_profit') {
                  actionLabel = '🎯 SELL · TP';
                  actionColor = 'text-green-500';
                } else if (t.exit_reason === 'stop_loss') {
                  actionLabel = '🛑 SELL · SL';
                  actionColor = 'text-red-500';
                } else if (t.exit_reason === 'max_hold') {
                  actionLabel = '⏱ SELL · timeout';
                  actionColor = isWin ? 'text-green-500' : isLoss ? 'text-red-500' : 'text-muted-foreground';
                } else {
                  actionLabel = '🔴 SELL';
                  actionColor = 'text-muted-foreground';
                }

                const price = isBuy ? t.entry_price : t.exit_price ?? 0;
                const amountUsd = isBuy ? t.entry_amount_usd : (t.exit_price ?? 0) * t.entry_tokens;

                return (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                    </td>
                    <td className={`px-4 py-2 font-semibold text-xs ${actionColor}`}>
                      {actionLabel}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/coin/${t.chain}/${t.pair_address}`}
                        className="font-semibold hover:underline"
                      >
                        {t.token_symbol ?? '-'}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        {t.signal_kind === 'whale_buy'
                          ? '🐋 whale'
                          : t.signal_kind === 'cluster_buy'
                            ? '🟢 cluster'
                            : '👤 wallet'}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">
                      {formatPrice(price)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{usd(amountUsd)}</td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-medium ${
                        isBuy ? 'text-muted-foreground' : isWin ? 'text-green-500' : isLoss ? 'text-red-500' : ''
                      }`}
                    >
                      {isBuy
                        ? '—'
                        : `${usd(t.pnl_usd)} (${t.pnl_pct !== null ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct.toFixed(2)}%` : '-'})`}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    No events matching this filter.
                  </td>
                </tr>
              )}
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
