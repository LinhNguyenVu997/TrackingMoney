'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function RemoveWatchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from('watchlist').delete().eq('id', id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Removed from watchlist');
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={remove} disabled={pending} aria-label="Remove">
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
