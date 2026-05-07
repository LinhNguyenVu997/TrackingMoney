'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface AlertPayload {
  symbol?: string;
  side?: string;
  amountUsd?: number;
}

interface AlertRow {
  id: string;
  payload: AlertPayload;
}

export function RealtimeAlerts() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const channelName = `alerts-toast-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${user.id}`,
          },
          (msg) => {
            const row = msg.new as AlertRow;
            const p = row.payload;
            toast(
              `${p.side?.toUpperCase() ?? 'ALERT'} ${p.symbol ?? ''}`,
              {
                description: p.amountUsd
                  ? `$${p.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : undefined,
              }
            );
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
