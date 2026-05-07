'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  chain: string;
  pairAddress: string;
  symbol?: string;
  name?: string;
}

export function WatchButton({ chain, pairAddress, symbol, name }: Props) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [watched, setWatched] = useState<boolean | null>(configured ? null : false);
  const [pending, setPending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setUserId(null);
        setWatched(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from('watchlist')
        .select('id')
        .eq('chain', chain)
        .eq('pair_address', pairAddress)
        .maybeSingle();
      if (active) setWatched(!!data);
    })();
    return () => {
      active = false;
    };
  }, [chain, pairAddress, configured]);

  async function toggle() {
    if (!configured) {
      toast.error('Auth not configured');
      return;
    }
    if (!userId) {
      router.push(`/login?next=/coin/${chain}/${pairAddress}`);
      return;
    }
    setPending(true);
    const supabase = createClient();
    if (watched) {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('chain', chain)
        .eq('pair_address', pairAddress);
      if (error) {
        toast.error(error.message);
      } else {
        setWatched(false);
        toast.success('Removed from watchlist');
      }
    } else {
      const { error } = await supabase.from('watchlist').insert({
        user_id: userId,
        chain,
        pair_address: pairAddress,
        token_symbol: symbol,
        token_name: name,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setWatched(true);
        toast.success('Added to watchlist');
      }
    }
    setPending(false);
  }

  return (
    <Button
      variant={watched ? 'default' : 'outline'}
      size="sm"
      onClick={toggle}
      disabled={pending || watched === null}
    >
      <Star className={`w-4 h-4 mr-1 ${watched ? 'fill-current' : ''}`} />
      {watched ? 'Saved' : 'Save'}
    </Button>
  );
}
