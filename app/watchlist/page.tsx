import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { RemoveWatchButton } from '@/components/remove-watch-button';

interface WatchlistRow {
  id: string;
  chain: string;
  pair_address: string;
  token_symbol: string | null;
  token_name: string | null;
  created_at: string;
}

export default async function WatchlistPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="container mx-auto p-6 max-w-6xl">
        <Card className="p-8 text-center text-muted-foreground">
          Supabase not configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
        </Card>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/watchlist');
  }

  const { data, error } = await supabase
    .from('watchlist')
    .select('id, chain, pair_address, token_symbol, token_name, created_at')
    .order('created_at', { ascending: false });

  const items: WatchlistRow[] = data ?? [];

  return (
    <main className="container mx-auto p-6 max-w-6xl space-y-6">
      <h1 className="text-3xl font-bold">Watchlist</h1>
      {error ? (
        <p className="text-sm text-red-500">Failed to load: {error.message}</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No coins yet. Open any coin and tap the star to save it here.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Token</th>
                <th className="p-3 text-left">Chain</th>
                <th className="p-3 text-left">Pair</th>
                <th className="p-3 text-right">Added</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <Link
                      href={`/coin/${row.chain}/${row.pair_address}`}
                      className="font-semibold hover:underline"
                    >
                      {row.token_symbol ?? '-'}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {row.token_name}
                    </div>
                  </td>
                  <td className="p-3 text-sm">{row.chain}</td>
                  <td className="p-3 font-mono text-xs">
                    {row.pair_address.slice(0, 4)}...{row.pair_address.slice(-4)}
                  </td>
                  <td className="p-3 text-right text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <RemoveWatchButton id={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
