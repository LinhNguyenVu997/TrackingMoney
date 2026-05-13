import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { TrackedWalletsList } from '@/components/tracked-wallets-list';

export default async function WalletsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="container mx-auto p-6 max-w-4xl">
        <Card className="p-8 text-center text-muted-foreground">Supabase not configured.</Card>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wallets');

  return (
    <main className="container mx-auto p-6 max-w-4xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tracked Wallets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get alerts when these wallets buy or sell tokens
        </p>
      </div>
      <TrackedWalletsList />
    </main>
  );
}
