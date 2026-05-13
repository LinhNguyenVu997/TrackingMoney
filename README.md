# 🐋 Whale Tracker

Real-time Solana whale-buy alerts with a CMC-style UI. Frontend (Next.js 16) + background worker (Node + Helius WebSocket).

## Features

- **Trending list** — top Solana tokens by 24h volume (auto-refresh 5s)
- **Coin detail** — Lightweight Charts candlestick, recent trades, top holders, FDV/liquidity/volume stats
- **Watchlist** — save tokens with per-token whale threshold
- **Tracked wallets** — get alerts when specific wallets swap
- **Alerts** — three signal types:
  - 🐋 **Whale buy** — single buy ≥ threshold
  - 🟢 **Cluster buy** — N coordinated buys in window
  - 👤 **Wallet activity** — tracked wallet did a swap
- **Telegram bot** — DM alerts + commands (`/watchlist`, `/wallets`, `/stop`, `/resume`, `/threshold`)
- **Realtime UI** — Supabase Realtime → toast + unread badge

## Stack

| Layer | Tech |
|---|---|
| UI | Next.js 16 (app router, Turbopack), Tailwind 4, shadcn |
| Charts | TradingView Lightweight Charts v5 |
| Auth + DB | Supabase (Postgres + Realtime + Auth) |
| Worker | Node + tsx, Helius WebSocket (`logsSubscribe`) |
| Notifications | Telegram bot API |
| Data | DexScreener, GeckoTerminal (chart/trades), Helius (holders) |

## Local setup

### 1. Install

```bash
pnpm install
```

### 2. Provision Supabase

- Create project at https://supabase.com
- Run SQL files in order in **SQL Editor**:
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0002_alerts.sql`
  - `supabase/migrations/0003_rules_and_wallets.sql`

### 3. Frontend env (`whale-tracker/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
HELIUS_API_KEY=...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
```

### 4. Worker env (`worker/.env`)

```
SUPABASE_URL=https://<id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
HELIUS_API_KEY=...
TELEGRAM_BOT_TOKEN=123:ABC...

WHALE_MIN_USD=1000
CLUSTER_MIN_USD=200
CLUSTER_COUNT=3
CLUSTER_WINDOW_SEC=300
COOLDOWN_SEC=300
WATCHLIST_REFRESH_SEC=60
```

### 5. Run

Terminal 1:
```bash
pnpm dev
```

Terminal 2:
```bash
pnpm --filter whale-tracker-worker dev
```

Open http://localhost:3000.

## Deploy

**Frontend → Vercel**: import the GitHub repo, paste frontend env vars, deploy.

**Worker → Railway**: new project from GitHub repo, set **Root Directory** to `worker`, paste worker env vars. See `worker/README.md`.

## Project structure

```
whale-tracker/
├── app/                       # Next 16 app router
│   ├── api/                   # Route handlers (proxies + Helius holders + Telegram link)
│   ├── coin/[chain]/[pair]/   # Coin detail (CMC-style 2-col)
│   ├── auth/                  # OAuth callback + signout
│   ├── login/                 # Email + OAuth login
│   ├── watchlist/             # Saved tokens + per-token threshold
│   ├── wallets/               # Tracked wallets CRUD
│   ├── alerts/                # Alert feed (filter/pagination/realtime)
│   └── settings/              # Telegram link
├── components/                # UI components (shadcn-style)
├── lib/
│   ├── api.ts                 # Client API wrappers
│   └── supabase/              # Server + browser clients
├── proxy.ts                   # Next 16 proxy (formerly middleware) for auth refresh
├── supabase/migrations/       # SQL schemas
└── worker/                    # Background process (separate pnpm package)
    └── src/
        ├── helius.ts          # WS subscription manager
        ├── rpc.ts             # getTransaction
        ├── detector.ts        # Pool swap detection (fee-payer based)
        ├── wallet-detector.ts # Wallet activity detection
        ├── signals.ts         # Whale + cluster scoring + cooldown
        ├── telegram.ts        # Bot handlers + alert formatting
        └── index.ts           # Orchestrator
```

## Alert formula

Per `worker/src/signals.ts`:

1. Skip if `side !== 'buy'`
2. Skip if same pool was alerted within `COOLDOWN_SEC`
3. Trigger **whale_buy** if `amountUsd >= user's min_usd (or WHALE_MIN_USD default)`
4. Trigger **cluster_buy** if `>= CLUSTER_COUNT buys >= CLUSTER_MIN_USD/each in CLUSTER_WINDOW_SEC`

Tracked-wallet path: any swap on a wallet in `tracked_wallets` → alert (cooldown 60s per wallet+user).

## Notes

- Worker uses Helius **standard** WebSocket (`logsSubscribe`), not Atlas (paid). Trade-off: ~1-2s latency from `getTransaction` fetch per signature.
- Buyer detection uses transaction fee payer (signer), not max delta — avoids classifying pool as buyer.
- RLS enforced on all tables; users only see their own rows.
- Worker uses Supabase **service role** key to bypass RLS for fan-out writes.
