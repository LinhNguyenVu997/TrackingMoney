'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { getPair } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WatchButton } from '@/components/watch-button';

interface Props {
  chain: string;
  pairAddress: string;
}

function formatUsd(n: number | undefined | null) {
  if (!n) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function CoinSidebar({ chain, pairAddress }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['pair', chain, pairAddress],
    queryFn: () => getPair(chain, pairAddress),
    refetchInterval: 30 * 1000,
    staleTime: 30 * 1000,
  });

  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!data) return <div className="text-muted-foreground">Pair not found</div>;

  const change = data.priceChange?.h24 ?? 0;
  const positive = change >= 0;
  const baseAddr = data.baseToken.address;

  async function copyAddr() {
    await navigator.clipboard.writeText(baseAddr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{data.baseToken.name}</h1>
            <span className="text-sm text-muted-foreground font-mono">{data.baseToken.symbol}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 capitalize">{data.chainId}</div>
        </div>
        <WatchButton
          chain={chain}
          pairAddress={pairAddress}
          symbol={data.baseToken.symbol}
          name={data.baseToken.name}
        />
      </div>

      <div>
        <div className="text-4xl font-bold tracking-tight tabular-nums">
          ${parseFloat(data.priceUsd).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
          })}
        </div>
        <div
          className={`flex items-center gap-1 mt-1 text-sm font-semibold ${positive ? 'text-green-500' : 'text-red-500'}`}
        >
          {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {positive ? '+' : ''}
          {change.toFixed(2)}% (24h)
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="FDV" value={formatUsd(data.fdv)} />
        <StatCard label="Liquidity" value={formatUsd(data.liquidity?.usd)} />
        <StatCard label="Volume (24h)" value={formatUsd(data.volume?.h24)} fullWidth />
      </div>

      <Card className="p-3 space-y-3 text-sm">
        <Row label="Token">
          <button
            onClick={copyAddr}
            className="font-mono text-xs flex items-center gap-1 hover:underline"
          >
            {baseAddr.slice(0, 4)}...{baseAddr.slice(-4)}
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </Row>
        <Row label="Pair">
          <span className="font-mono text-xs">
            {pairAddress.slice(0, 4)}...{pairAddress.slice(-4)}
          </span>
        </Row>
        <Row label="Created">
          <span className="text-xs text-muted-foreground">
            {data.pairCreatedAt ? new Date(data.pairCreatedAt).toLocaleDateString() : '-'}
          </span>
        </Row>
      </Card>

      <div className="flex flex-col gap-2">
        <a
          href={`https://dexscreener.com/${chain}/${pairAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-sm p-2 rounded border hover:bg-muted/50"
        >
          <span>DexScreener</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        {chain === 'solana' && (
          <a
            href={`https://solscan.io/token/${baseAddr}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-sm p-2 rounded border hover:bg-muted/50"
          >
            <span>Solscan</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <Card className={`p-3 ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums mt-1">{value}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
