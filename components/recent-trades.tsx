'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { getTrades } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function RecentTrades({ chain, pairAddress }: { chain: string; pairAddress: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['trades', chain, pairAddress],
    queryFn: () => getTrades(chain, pairAddress),
    refetchInterval: 15 * 1000,
  });

  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-3">Recent trades</h2>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trades available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Side</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-right">Value</th>
                <th className="p-2 text-left">Wallet</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 30).map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2 text-muted-foreground">
                    {formatDistanceToNow(new Date(t.blockTimestamp), { addSuffix: true })}
                  </td>
                  <td className={`p-2 font-semibold ${t.kind === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                    {t.kind.toUpperCase()}
                  </td>
                  <td className="p-2 text-right font-mono">
                    ${t.priceUsd > 0 ? t.priceUsd.toFixed(6) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    ${t.volumeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="p-2 font-mono text-xs">
                    {t.wallet.slice(0, 4)}...{t.wallet.slice(-4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
