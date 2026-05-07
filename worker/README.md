# Whale Tracker Worker

Listens to Helius Atlas WebSocket for swap transactions on user-watchlisted Solana pools, inserts alerts into Supabase, and pushes Telegram DMs.

## Local development

1. Create `.env` in this directory:

   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Settings → API → service_role (NOT anon)
   HELIUS_API_KEY=...
   TELEGRAM_BOT_TOKEN=123:ABC               # from @BotFather
   WHALE_MIN_USD=1000                       # optional, default 1000
   WATCHLIST_REFRESH_SEC=60                 # optional, default 60
   ```

2. From the repo root:

   ```
   pnpm --filter whale-tracker-worker dev
   ```

   The worker connects to Helius, subscribes to all unique pool addresses currently in the `watchlist` table, and listens for swaps above `WHALE_MIN_USD`.

## Deployment to Railway

1. Push the repo to GitHub.
2. Railway → New project → Deploy from GitHub → pick this repo.
3. Set the **Root directory** to `worker`.
4. **Build command**: `pnpm install`
5. **Start command**: `pnpm start`
6. Add the env vars listed above in Railway → Variables.

Railway will keep the worker process running 24/7. There is no HTTP server — this is a long-running daemon.

## How it works

- `loadWatchlist()` fetches all rows from `watchlist` (service-role bypasses RLS).
- For each unique `pair_address` it asks DexScreener for the base mint + current price (cached in memory).
- Helius `transactionSubscribe` is called with `accountInclude` = list of pool addresses.
- On each notification, it diffs `pre/postTokenBalances` for the watched mint, multiplies the largest delta by current price, and triggers an alert if above threshold.
- An alert means: insert into `alerts` (Realtime broadcasts to the app) **and** Telegram DM to every linked user.
- Watchlist is refreshed every 60s; price cache every 60s; signature dedupe TTL 5 min.

## Telegram link flow

- User clicks "Generate link code" in `/settings` → app inserts a row in `telegram_link_codes` (10 min TTL).
- User opens `t.me/<bot>?start=<code>` → bot receives `/start <code>` → consumes code, writes `telegram_links(user_id, chat_id)`.
- Worker queries `telegram_links` whenever it needs to DM a user.
