'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTrendingPairs } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';

function formatUsd(n: number | undefined | null) {
  if (!n) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function CoinTable() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['trending', 'solana'],
    queryFn: () => getTrendingPairs('solana'),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-medium w-10">#</th>
            <th className="px-4 py-3 text-left font-medium">Token</th>
            <th className="px-4 py-3 text-right font-medium">Price</th>
            <th className="px-4 py-3 text-right font-medium">24h %</th>
            <th className="px-4 py-3 text-right font-medium">Volume (24h)</th>
            <th className="px-4 py-3 text-right font-medium">Liquidity</th>
            <th className="px-4 py-3 text-right font-medium">Age</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((pair, idx) => {
            const change = pair.priceChange?.h24 ?? 0;
            const positive = change >= 0;
            return (
              <tr
                key={pair.pairAddress}
                className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => router.push(`/coin/${pair.chainId}/${pair.pairAddress}`)}
              >
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/coin/${pair.chainId}/${pair.pairAddress}`}
                    className="block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold">{pair.baseToken.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {pair.baseToken.name}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  ${parseFloat(pair.priceUsd).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${positive ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {positive ? '+' : ''}
                    {change.toFixed(2)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUsd(pair.volume?.h24)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatUsd(pair.liquidity?.usd)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {pair.pairCreatedAt
                    ? formatDistanceToNow(pair.pairCreatedAt, { addSuffix: true })
                    : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </Card>
  );
}
