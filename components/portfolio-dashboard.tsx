'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getPair } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { ActivityLog } from '@/components/activity-log';
import { DepositRequestPanel } from '@/components/deposit-request-button';

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

function pct(n: number | null | undefined) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function usd(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || !isFinite(n)) return '-';
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

export function PortfolioDashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [startingBalance, setStartingBalance] = useState(1000);
  const [livePrices, setLivePrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const [tradesRes, settingsRes] = await Promise.all([
        supabase
          .from('paper_trades')
          .select(
            'id, chain, pair_address, token_symbol, signal_kind, entry_price, entry_amount_usd, entry_tokens, entry_at, exit_price, exit_at, exit_reason, pnl_usd, pnl_pct, status'
          )
          .order('entry_at', { ascending: false })
          .limit(500),
        supabase.from('paper_settings').select('starting_balance').maybeSingle(),
      ]);
      if (!active) return;
      setTrades((tradesRes.data ?? []) as Trade[]);
      if (settingsRes.data?.starting_balance) {
        setStartingBalance(Number(settingsRes.data.starting_balance));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `paper-trades-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    let active = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'paper_trades', filter: `user_id=eq.${user.id}` },
          (msg) => {
            const row = (msg.new ?? msg.old) as Trade;
            setTrades((prev) => {
              if (msg.eventType === 'INSERT') return [row, ...prev];
              if (msg.eventType === 'UPDATE') return prev.map((t) => (t.id === row.id ? row : t));
              if (msg.eventType === 'DELETE') return prev.filter((t) => t.id !== row.id);
              return prev;
            });
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const open = trades.filter((t) => t.status === 'open');
  const openKeys = open.map((t) => `${t.chain}:${t.pair_address}`).sort().join(',');

  useEffect(() => {
    if (!openKeys) return;
    let active = true;
    const fetchPrices = async () => {
      const unique = Array.from(new Set(openKeys.split(',')));
      const results = await Promise.all(
        unique.map(async (k) => {
          const [chain, pair] = k.split(':');
          const data = await getPair(chain, pair);
          return [k, data ? parseFloat(data.priceUsd) : null] as const;
        })
      );
      if (!active) return;
      const map = new Map<string, number>();
      for (const [k, v] of results) if (v !== null && isFinite(v)) map.set(k, v);
      setLivePrices(map);
    };
    fetchPrices();
    const id = setInterval(fetchPrices, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [openKeys]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const closed = trades.filter((t) => t.status === 'closed');

  const realizedPnl = closed.reduce((s, t) => s + (t.pnl_usd ?? 0), 0);
  const realizedInvested = closed.reduce((s, t) => s + t.entry_amount_usd, 0);
  const realizedRoi = realizedInvested > 0 ? (realizedPnl / realizedInvested) * 100 : 0;

  let unrealizedPnl = 0;
  let openExposure = 0;
  for (const t of open) {
    openExposure += t.entry_amount_usd;
    const livePrice = livePrices.get(`${t.chain}:${t.pair_address}`);
    if (livePrice !== undefined) {
      const currentValue = t.entry_tokens * livePrice;
      unrealizedPnl += currentValue - t.entry_amount_usd;
    }
  }

  const totalPnl = realizedPnl + unrealizedPnl;
  const currentEquity = startingBalance + totalPnl;
  const totalRoi = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0;

  const wins = closed.filter((t) => (t.pnl_usd ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl_usd ?? 0) < 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const totalWin = wins.reduce((s, t) => s + (t.pnl_usd ?? 0), 0);
  const totalLoss = losses.reduce((s, t) => s + (t.pnl_usd ?? 0), 0);
  const avgWin = wins.length > 0 ? totalWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
  const best = closed.reduce(
    (b, t) => ((t.pnl_pct ?? -Infinity) > (b?.pnl_pct ?? -Infinity) ? t : b),
    null as Trade | null
  );
  const worst = closed.reduce(
    (b, t) => ((t.pnl_pct ?? Infinity) < (b?.pnl_pct ?? Infinity) ? t : b),
    null as Trade | null
  );

  const equityPositive = currentEquity >= startingBalance;
  const hasNoTrades = trades.length === 0;

  return (
    <div className="space-y-6">
      {/* Hero equity */}
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Wallet className="w-4 h-4" /> Current equity
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className="text-4xl font-bold tabular-nums">{usd(currentEquity)}</div>
          <div
            className={`flex items-center gap-1 text-base font-semibold ${equityPositive ? 'text-green-500' : 'text-red-500'}`}
          >
            {equityPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {usd(totalPnl)} ({pct(totalRoi)})
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Starting {usd(startingBalance)} · {trades.length} trades · {open.length} open
        </div>
      </Card>

      {/* Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Realized PnL"
          value={usd(realizedPnl)}
          sub={`${closed.length} closed · ${pct(realizedRoi)}`}
          tone={realizedPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Unrealized PnL"
          value={usd(unrealizedPnl)}
          sub={open.length > 0 ? `${open.length} open · ${usd(openExposure)} exposed` : 'no open'}
          tone={unrealizedPnl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          sub={`${wins.length} W / ${losses.length} L`}
        />
        <StatCard
          label="Avg W / L"
          value={`${usd(avgWin, 1)} / ${usd(avgLoss, 1)}`}
          sub={
            losses.length > 0 && avgLoss !== 0
              ? `Edge ${(avgWin / Math.abs(avgLoss)).toFixed(2)}x`
              : '—'
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total wins" value={usd(totalWin)} tone="green" />
        <StatCard label="Total losses" value={usd(totalLoss)} tone="red" />
        <StatCard label="Best" value={pct(best?.pnl_pct)} sub={best?.token_symbol ?? ''} tone="green" />
        <StatCard label="Worst" value={pct(worst?.pnl_pct)} sub={worst?.token_symbol ?? ''} tone="red" />
      </div>

      <DepositRequestPanel />

      {hasNoTrades && (
        <Card className="p-6 text-center text-muted-foreground text-sm space-y-1">
          <p>No paper trades yet.</p>
          <p className="text-xs">
            Enable paper trading in{' '}
            <Link href="/settings" className="underline">
              Settings
            </Link>{' '}
            and add tokens to your watchlist. Trades open automatically when alerts fire.
          </p>
        </Card>
      )}

      {/* Open positions */}
      {open.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Open positions ({open.length})</h2>
          <OpenTradeTable trades={open} livePrices={livePrices} />
        </div>
      )}

      {/* Activity log — chronological buy/sell events */}
      <ActivityLog trades={trades} />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'green' | 'red';
}) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums ${
          tone === 'green' ? 'text-green-500' : tone === 'red' ? 'text-red-500' : ''
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
    </Card>
  );
}

const OPEN_PAGE_SIZE = 10;

function OpenTradeTable({
  trades,
  livePrices,
}: {
  trades: Trade[];
  livePrices: Map<string, number>;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(trades.length / OPEN_PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = trades.slice(safePage * OPEN_PAGE_SIZE, (safePage + 1) * OPEN_PAGE_SIZE);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Token</th>
              <th className="px-4 py-3 text-left font-medium">Signal</th>
              <th className="px-4 py-3 text-right font-medium">Entry</th>
              <th className="px-4 py-3 text-right font-medium">Now</th>
              <th className="px-4 py-3 text-right font-medium">Size</th>
              <th className="px-4 py-3 text-right font-medium">Unrealized</th>
              <th className="px-4 py-3 text-left font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const live = livePrices.get(`${t.chain}:${t.pair_address}`);
              const currentValue = live ? t.entry_tokens * live : null;
              const unrealized = currentValue !== null ? currentValue - t.entry_amount_usd : null;
              const unrealizedPct = unrealized !== null ? (unrealized / t.entry_amount_usd) * 100 : null;
              const positive = (unrealized ?? 0) >= 0;
              return (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link
                      href={`/coin/${t.chain}/${t.pair_address}`}
                      className="font-semibold hover:underline"
                    >
                      {t.token_symbol ?? '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {t.signal_kind === 'whale_buy'
                      ? '🐋 whale'
                      : t.signal_kind === 'cluster_buy'
                        ? '🟢 cluster'
                        : '👤 wallet'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs">
                    ${t.entry_price < 0.01 ? t.entry_price.toExponential(2) : t.entry_price.toFixed(4)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs">
                    {live
                      ? `$${live < 0.01 ? live.toExponential(2) : live.toFixed(4)}`
                      : '...'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {usd(t.entry_amount_usd)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums font-medium ${
                      unrealized === null
                        ? 'text-muted-foreground'
                        : positive
                          ? 'text-green-500'
                          : 'text-red-500'
                    }`}
                  >
                    {unrealized === null ? '...' : `${usd(unrealized)} (${pct(unrealizedPct)})`}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(t.entry_at), { addSuffix: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={safePage}
        pageCount={pageCount}
        total={trades.length}
        pageSize={OPEN_PAGE_SIZE}
        onPageChange={setPage}
      />
    </Card>
  );
}

