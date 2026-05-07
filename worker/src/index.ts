import { config } from './config.js';
import { loadWatchlist, getTelegramChatId, insertAlert } from './supabase.js';
import { getPairMeta, refreshPrices, type PairMeta } from './dex.js';
import { HeliusStream } from './helius.js';
import { getTransaction } from './rpc.js';
import { detectSwap } from './detector.js';
import { evaluateBuy, pruneAll, type Alert } from './signals.js';
import { sendAlert, stopBot } from './telegram.js';

interface Watch {
  pair: PairMeta;
  userIds: string[];
}

const watches = new Map<string, Watch>();
const seenSignatures = new Map<string, number>();
const SIG_TTL_MS = 5 * 60 * 1000;

function pruneSignatures() {
  const cutoff = Date.now() - SIG_TTL_MS;
  for (const [sig, ts] of seenSignatures) {
    if (ts < cutoff) seenSignatures.delete(sig);
  }
}

async function rebuildWatches(stream: HeliusStream) {
  const rows = await loadWatchlist();
  const grouped = new Map<string, string[]>();
  for (const r of rows) {
    if (r.chain !== 'solana') continue;
    const key = r.pair_address;
    const arr = grouped.get(key) ?? [];
    arr.push(r.user_id);
    grouped.set(key, arr);
  }

  const next = new Map<string, Watch>();
  for (const [pairAddress, userIds] of grouped) {
    const meta = await getPairMeta('solana', pairAddress);
    if (!meta) continue;
    next.set(pairAddress, { pair: meta, userIds });
  }

  watches.clear();
  for (const [k, v] of next) watches.set(k, v);

  const accounts = Array.from(next.keys());
  console.log(`[worker] watching ${accounts.length} pools for ${rows.length} watchlist rows`);
  stream.resubscribe(accounts);
}

async function onSignature(pool: string, signature: string, err: unknown) {
  if (err) return;
  if (seenSignatures.has(signature)) return;
  seenSignatures.set(signature, Date.now());

  const watch = watches.get(pool);
  if (!watch) return;

  let txn: unknown;
  try {
    txn = await getTransaction(signature);
  } catch (e) {
    console.error(`[fetch-fail] ${watch.pair.symbol}: ${(e as Error).message}`);
    return;
  }
  if (!txn) return;

  const event = detectSwap(txn as never, watch.pair);
  if (!event) return;

  if (config.debug) {
    console.log(
      `[swap] ${event.symbol} ${event.side} $${event.amountUsd.toFixed(2)} by ${event.buyer.slice(0, 6)}...`
    );
  }

  const alert = evaluateBuy(event);
  if (!alert) return;

  const tag = alert.reason === 'whale_buy' ? '🐋 whale' : '🟢 cluster';
  console.log(
    `[alert ${tag}] ${event.symbol} buy $${event.amountUsd.toFixed(0)}` +
      (alert.clusterCount ? ` (cluster ${alert.clusterCount} buys, total $${alert.clusterTotalUsd?.toFixed(0)})` : '')
  );

  await fanOut(watch.userIds, alert);
}

async function fanOut(userIds: string[], alert: Alert) {
  const payload = {
    ...alert.event,
    reason: alert.reason,
    clusterCount: alert.clusterCount,
    clusterTotalUsd: alert.clusterTotalUsd,
  };
  for (const userId of userIds) {
    await insertAlert({
      user_id: userId,
      kind: alert.reason,
      chain: alert.event.chain,
      pair_address: alert.event.pairAddress,
      payload: payload as unknown as Record<string, unknown>,
    });
    const chatId = await getTelegramChatId(userId);
    if (chatId) await sendAlert(chatId, alert);
  }
}

async function main() {
  console.log(
    `[worker] starting (whale=$${config.whaleMinUsd}, cluster=${config.clusterCount}x$${config.clusterMinUsd}/${config.clusterWindowSec}s, cooldown=${config.cooldownSec}s)`
  );
  const stream = new HeliusStream(onSignature);
  stream.connect();

  await rebuildWatches(stream);
  setInterval(() => rebuildWatches(stream).catch(console.error), config.watchlistRefreshSec * 1000);
  setInterval(() => refreshPrices().catch(console.error), 60_000);
  setInterval(pruneSignatures, 60_000);
  setInterval(pruneAll, 60_000);

  process.on('SIGINT', () => {
    console.log('[worker] shutting down');
    stopBot();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
