'use client';

import { useQuery } from '@tanstack/react-query';
import { getTrendingPairs } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function CoinTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['trending', 'solana'],
    queryFn: () => getTrendingPairs('solana'),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50 text-xs uppercase">
          <tr>
            <th className="p-3 text-left">Token</th>
            <th className="p-3 text-right">Price</th>
            <th className="p-3 text-right">24h Change</th>
            <th className="p-3 text-right">Volume</th>
            <th className="p-3 text-right">Liquidity</th>
            <th className="p-3 text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((pair) => (
            <tr key={pair.pairAddress} className="border-t hover:bg-muted/30">
              <td className="p-3">
                <div className="font-semibold">{pair.baseToken.symbol}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {pair.baseToken.name}
                </div>
              </td>
              <td className="p-3 text-right font-mono">
                ${parseFloat(pair.priceUsd).toFixed(6)}
              </td>
              <td className="p-3 text-right">
                <Badge variant={pair.priceChange?.h24 >= 0 ? 'default' : 'destructive'}>
                  {pair.priceChange?.h24 >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {pair.priceChange?.h24?.toFixed(2)}%
                </Badge>
              </td>
              <td className="p-3 text-right">
                ${(pair.volume?.h24 / 1000).toFixed(1)}k
              </td>
              <td className="p-3 text-right">
                ${(pair.liquidity?.usd / 1000).toFixed(1)}k
              </td>
              <td className="p-3 text-right text-xs text-muted-foreground">
                {pair.pairCreatedAt
                  ? formatDistanceToNow(pair.pairCreatedAt, { addSuffix: true })
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
