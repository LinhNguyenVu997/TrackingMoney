'use client';

import { useQuery } from '@tanstack/react-query';
import { getPair, getHolders } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function TopHolders({ chain, pairAddress }: { chain: string; pairAddress: string }) {
  const { data: pair } = useQuery({
    queryKey: ['pair', chain, pairAddress],
    queryFn: () => getPair(chain, pairAddress),
    refetchInterval: 30 * 1000,
    staleTime: 30 * 1000,
  });

  const mint = pair?.baseToken.address;

  const { data: holders, isLoading } = useQuery({
    queryKey: ['holders', mint],
    queryFn: () => getHolders(mint!),
    enabled: !!mint,
    refetchInterval: 60 * 1000,
    staleTime: 60 * 1000,
  });

  const ZERO = BigInt(0);
  const totalAmount =
    holders?.reduce((sum, h) => sum + BigInt(h.amount), ZERO) ?? ZERO;

  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-3">Top holders</h2>
      {!mint || isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : holders == null ? (
        <p className="text-sm text-muted-foreground">
          Set <code className="text-xs bg-muted px-1 rounded">HELIUS_API_KEY</code> in <code className="text-xs bg-muted px-1 rounded">.env.local</code> to enable holders.
        </p>
      ) : holders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No holders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Owner</th>
                <th className="p-2 text-right">% of top {holders.length}</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h, i) => {
                const amount = BigInt(h.amount);
                const pct = totalAmount > ZERO
                  ? Number((amount * BigInt(10000)) / totalAmount) / 100
                  : 0;
                return (
                  <tr key={h.owner} className="border-t">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-mono text-xs">
                      {h.owner.slice(0, 6)}...{h.owner.slice(-4)}
                    </td>
                    <td className="p-2 text-right font-mono">{pct.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
