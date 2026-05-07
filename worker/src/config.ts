function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  heliusApiKey: required('HELIUS_API_KEY'),
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  watchlistRefreshSec: Number(process.env.WATCHLIST_REFRESH_SEC ?? 60),
  debug: process.env.DEBUG === '1',

  whaleMinUsd: Number(process.env.WHALE_MIN_USD ?? 1000),
  clusterMinUsd: Number(process.env.CLUSTER_MIN_USD ?? 200),
  clusterCount: Number(process.env.CLUSTER_COUNT ?? 3),
  clusterWindowSec: Number(process.env.CLUSTER_WINDOW_SEC ?? 300),
  cooldownSec: Number(process.env.COOLDOWN_SEC ?? 300),
};
