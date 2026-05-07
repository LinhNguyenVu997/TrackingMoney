import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { AlertsList } from '@/components/alerts-list';

export default async function AlertsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="container mx-auto p-6 max-w-6xl">
        <Card className="p-8 text-center text-muted-foreground">
          Supabase not configured.
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/alerts');

  return (
    <main className="container mx-auto p-6 max-w-6xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live whale buy &amp; cluster signals on your watchlist
        </p>
      </div>
      <AlertsList />
    </main>
  );
}
