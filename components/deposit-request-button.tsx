'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface DepositRequest {
  id: string;
  amount_usd: number;
  status: 'pending' | 'approved' | 'rejected';
  user_note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export function DepositRequestPanel() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1000');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [requests, setRequests] = useState<DepositRequest[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('deposit_requests')
        .select('id, amount_usd, status, user_note, admin_note, created_at, reviewed_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (active) setRequests((data ?? []) as DepositRequest[]);
    })();

    const channelName = `deposits-user-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${user.id}` },
          (msg) => {
            const row = (msg.new ?? msg.old) as DepositRequest;
            setRequests((prev) => {
              if (msg.eventType === 'INSERT') return [row, ...prev];
              if (msg.eventType === 'UPDATE') return prev.map((r) => (r.id === row.id ? row : r));
              if (msg.eventType === 'DELETE') return prev.filter((r) => r.id !== row.id);
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

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }
    setPending(true);
    const res = await fetch('/api/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_usd: amt, user_note: note || undefined }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      toast.error(error ?? 'Failed');
      return;
    }
    toast.success('Request submitted. Waiting for admin review.');
    setOpen(false);
    setAmount('1000');
    setNote('');
  }

  const pendingList = requests.filter((r) => r.status === 'pending');
  const recentList = requests.filter((r) => r.status !== 'pending').slice(0, 5);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-semibold">Deposit funds</h2>
          <p className="text-xs text-muted-foreground">
            Increase your simulated equity. Admin reviews each request.
          </p>
        </div>
        <Button onClick={() => setOpen((o) => !o)}>{open ? 'Cancel' : 'Request deposit'}</Button>
      </div>

      {open && (
        <div className="space-y-2 border-t pt-3">
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Input
              type="number"
              min="1"
              placeholder="Amount USD"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      )}

      {pendingList.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Pending ({pendingList.length})
          </div>
          {pendingList.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="font-semibold tabular-nums">
                ${r.amount_usd.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500">
                pending
              </span>
            </div>
          ))}
        </div>
      )}

      {recentList.length > 0 && (
        <div className="border-t pt-3 space-y-1">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Recent</div>
          {recentList.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <span className="tabular-nums">${r.amount_usd.toLocaleString()}</span>
              <span className="text-muted-foreground">
                {r.reviewed_at
                  ? formatDistanceToNow(new Date(r.reviewed_at), { addSuffix: true })
                  : '-'}
              </span>
              <span
                className={`px-2 py-0.5 rounded ${
                  r.status === 'approved'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
