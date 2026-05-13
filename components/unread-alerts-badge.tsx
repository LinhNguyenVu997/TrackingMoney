'use client';

import { useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export function UnreadAlertsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const channelName = `unread-badge-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    let active = true;

    async function refresh() {
      const { count: c } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (active) setCount(c ?? 0);
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      refresh();
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${user.id}`,
          },
          () => refresh()
        )
        .subscribe();
    })();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
      {count > 99 ? '99+' : count}
    </span>
  );
}
