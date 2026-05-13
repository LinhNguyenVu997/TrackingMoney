'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface DepositRow {
  id: string;
  user_id: string;
  amount_usd: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
}

export function DepositNotifier() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const channelName = `deposit-notifier-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      // Check if user is admin
      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const isAdmin = !!adminRow;

      // Subscribe to: own UPDATE (status change) + (if admin) any INSERT (new request)
      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'deposit_requests',
            filter: `user_id=eq.${user.id}`,
          },
          (msg) => {
            const row = msg.new as DepositRow;
            if (row.status === 'approved') {
              toast.success(
                `✅ Deposit approved: +$${row.amount_usd.toLocaleString()}`,
                { description: 'Your equity has been credited.' }
              );
            } else if (row.status === 'rejected') {
              toast.error(
                `❌ Deposit rejected: $${row.amount_usd.toLocaleString()}`,
                { description: row.admin_note ?? 'No reason provided' }
              );
            }
          }
        );

      if (isAdmin) {
        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'deposit_requests',
          },
          (msg) => {
            const row = msg.new as DepositRow;
            if (row.status === 'pending') {
              toast(`💰 New deposit request: $${row.amount_usd.toLocaleString()}`, {
                description: 'Review in /admin/deposits',
                action: {
                  label: 'Review',
                  onClick: () => {
                    window.location.href = '/admin/deposits';
                  },
                },
              });
            }
          }
        );
      }

      channel.subscribe();
    })();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
