import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';

export async function SiteHeader() {
  const configured = isSupabaseConfigured();
  let user: { email?: string; user_metadata?: { user_name?: string } } | null = null;
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  return (
    <header className="border-b">
      <div className="container mx-auto max-w-6xl flex items-center gap-4 p-4">
        <Link href="/" className="font-bold text-lg shrink-0 hover:opacity-80">
          🐋 Whale Tracker
        </Link>
        <div className="flex-1 max-w-sm">
          <SearchBar />
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Trending
            </Button>
          </Link>
          <Link href="/watchlist">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Watchlist
            </Button>
          </Link>
          <Link href="/alerts">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Alerts
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Settings
            </Button>
          </Link>
          {!configured ? (
            <span className="text-xs text-muted-foreground">Auth not configured</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.email ?? user.user_metadata?.user_name ?? 'Signed in'}
              </span>
              <form action="/auth/signout" method="post">
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
