'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface WatchRow {
  id: string;
  chain: string;
  pair_address: string;
  token_symbol: string | null;
  token_name: string | null;
  min_usd: number | null;
  active: boolean;
  created_at: string;
}

export function WatchlistTable() {
  const [items, setItems] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('watchlist')
        .select('id, chain, pair_address, token_symbol, token_name, min_usd, active, created_at')
        .order('created_at', { ascending: false });
      if (!active) return;
      setItems((data ?? []) as WatchRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('watchlist').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((r) => r.id !== id));
    toast.success('Removed');
  }

  async function toggleActive(id: string, active: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from('watchlist').update({ active }).eq('id', id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
  }

  async function saveMinUsd(id: string) {
    const v = drafts[id];
    const num = v === '' ? null : Number(v);
    if (num !== null && (!Number.isFinite(num) || num < 0)) {
      toast.error('Invalid amount');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('watchlist').update({ min_usd: num }).eq('id', id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, min_usd: num } : r)));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast.success('Threshold saved');
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No coins yet. Open any coin and tap Save.
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Token</th>
              <th className="px-4 py-3 text-left font-medium">Pair</th>
              <th className="px-4 py-3 text-right font-medium">Min $ (whale)</th>
              <th className="px-4 py-3 text-center font-medium">Active</th>
              <th className="px-4 py-3 text-right font-medium">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const draftValue = drafts[row.id] ?? (row.min_usd?.toString() ?? '');
              const dirty = drafts[row.id] !== undefined && drafts[row.id] !== (row.min_usd?.toString() ?? '');
              return (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link
                      href={`/coin/${row.chain}/${row.pair_address}`}
                      className="font-semibold hover:underline"
                    >
                      {row.token_symbol ?? '-'}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {row.token_name}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.pair_address.slice(0, 4)}...{row.pair_address.slice(-4)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        type="number"
                        min="0"
                        placeholder="default"
                        value={draftValue}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        className="w-24 h-8 text-right"
                      />
                      {dirty && (
                        <Button size="sm" variant="ghost" onClick={() => saveMinUsd(row.id)}>
                          Save
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(e) => toggleActive(row.id, e.target.checked)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(row.id)} aria-label="Remove">
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
