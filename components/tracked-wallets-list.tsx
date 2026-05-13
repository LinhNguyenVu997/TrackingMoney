'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface TrackedWallet {
  id: string;
  wallet_address: string;
  label: string | null;
  min_usd: number | null;
  active: boolean;
  created_at: string;
}

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function TrackedWalletsList() {
  const [items, setItems] = useState<TrackedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [minUsd, setMinUsd] = useState('');
  const [pending, setPending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('tracked_wallets')
        .select('id, wallet_address, label, min_usd, active, created_at')
        .order('created_at', { ascending: false });
      if (active) {
        setItems((data ?? []) as TrackedWallet[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const trimmed = address.trim();
    if (!SOLANA_ADDRESS_REGEX.test(trimmed)) {
      toast.error('Invalid Solana wallet address');
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tracked_wallets')
      .insert({
        user_id: userId,
        wallet_address: trimmed,
        label: label.trim() || null,
        min_usd: minUsd ? Number(minUsd) : null,
      })
      .select()
      .single();
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setItems((prev) => [data as TrackedWallet, ...prev]);
      setAddress('');
      setLabel('');
      setMinUsd('');
      toast.success('Wallet added');
    }
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('tracked_wallets').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((w) => w.id !== id));
    toast.success('Wallet removed');
  }

  async function toggleActive(id: string, active: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from('tracked_wallets').update({ active }).eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.map((w) => (w.id === id ? { ...w, active } : w)));
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[2fr_1fr_120px_auto]">
          <Input
            placeholder="Wallet address (Solana)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <Input
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Min $"
            value={minUsd}
            onChange={(e) => setMinUsd(e.target.value)}
            min="0"
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No tracked wallets yet. Add a Solana address above to start tracking.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Wallet</th>
                <th className="px-4 py-3 text-left font-medium">Label</th>
                <th className="px-4 py-3 text-right font-medium">Min $</th>
                <th className="px-4 py-3 text-center font-medium">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-4 py-2 font-mono text-xs">
                    {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-6)}
                  </td>
                  <td className="px-4 py-2">{w.label ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {w.min_usd ? `$${w.min_usd.toLocaleString()}` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={w.active}
                      onChange={(e) => toggleActive(w.id, e.target.checked)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(w.id)}
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
