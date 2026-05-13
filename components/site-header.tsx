import Link from 'next/link';
import { createClient, isSupabaseConfigured, isCurrentUserAdmin } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { UnreadAlertsBadge } from '@/components/unread-alerts-badge';

export async function SiteHeader() {
  const configured = isSupabaseConfigured();
  let user: { email?: string; user_metadata?: { user_name?: string } } | null = null;
  let isAdmin = false;
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) isAdmin = await isCurrentUserAdmin();
  }

  return (
    <header className="border-b">
      <div className="container mx-auto max-w-6xl flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <Link href="/" className="font-bold text-base sm:text-lg shrink-0 hover:opacity-80">
          🐋 Whale Tracker
        </Link>
        <div className="order-3 w-full sm:order-2 sm:flex-1 sm:max-w-sm">
          <SearchBar />
        </div>
        <nav className="order-2 sm:order-3 flex items-center gap-1 flex-wrap">
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
          <Link href="/wallets">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Wallets
            </Button>
          </Link>
          <Link href="/alerts">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Alerts
              <UnreadAlertsBadge />
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Portfolio
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="text-base font-medium">
              Settings
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/admin/deposits">
              <Button variant="ghost" size="sm" className="text-base font-medium text-blue-400">
                Admin
              </Button>
            </Link>
          )}
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
