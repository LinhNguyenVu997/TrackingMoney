import { config } from './config.js';
import {
  loadWatchlist,
  loadTrackedWallets,
  getTelegramChatId,
  insertAlert,
} from './supabase.js';
import { getPairMeta, refreshPrices, type PairMeta } from './dex.js';
import { HeliusStream } from './helius.js';
import { getTransaction } from './rpc.js';
import { detectSwap } from './detector.js';
import { detectWalletActivity } from './wallet-detector.js';
import { evaluateBuy, pruneAll } from './signals.js';
import { openPositionsForUsers, monitorOpenTrades } from './paper.js';
import { sendAlert, sendWalletActivity, stopBot } from './telegram.js';

interface PoolWatch {
  pair: PairMeta;
  userIds: string[];
  minUsdByUser: Map<string, number>;
}

interface WalletWatch {
  userIds: string[];
  label: string | null;
}

const poolWatches = new Map<string, PoolWatch>();          // key = pair address
const poolsByMint = new Map<string, string[]>();           // mint -> pair_addresses
const walletWatches = new Map<string, WalletWatch>();
const seenSignatures = new Map<string, number>();
const SIG_TTL_MS = 5 * 60 * 1000;

function pruneSignatures() {
  const cutoff = Date.now() - SIG_TTL_MS;
  for (const [sig, ts] of seenSignatures) {
    if (ts < cutoff) seenSignatures.delete(sig);
  }
}

async function rebuildWatches(stream: HeliusStream) {
  const [wlRows, twRows] = await Promise.all([loadWatchlist(), loadTrackedWallets()]);

  const grouped = new Map<string, { userIds: string[]; minUsd: Map<string, number> }>();
  for (const r of wlRows) {
    if (r.chain !== 'solana') continue;
    let g = grouped.get(r.pair_address);
    if (!g) {
      g = { userIds: [], minUsd: new Map() };
      grouped.set(r.pair_address, g);
    }
    g.userIds.push(r.user_id);
    if (r.min_usd) g.minUsd.set(r.user_id, r.min_usd);
  }

  const nextPools = new Map<string, PoolWatch>();
  const nextByMint = new Map<string, string[]>();
  for (const [pairAddress, info] of grouped) {
    const meta = await getPairMeta('solana', pairAddress);
    if (!meta) continue;
    nextPools.set(pairAddress, { pair: meta, userIds: info.userIds, minUsdByUser: info.minUsd });
    const arr = nextByMint.get(meta.baseMint) ?? [];
    arr.push(pairAddress);
    nextByMint.set(meta.baseMint, arr);
  }
  poolWatches.clear();
  poolsByMint.clear();
  for (const [k, v] of nextPools) poolWatches.set(k, v);
  for (const [k, v] of nextByMint) poolsByMint.set(k, v);

  const nextWallets = new Map<string, WalletWatch>();
  for (const r of twRows) {
    let w = nextWallets.get(r.wallet_address);
    if (!w) {
      w = { userIds: [], label: r.label };
      nextWallets.set(r.wallet_address, w);
    }
    w.userIds.push(r.user_id);
  }
  walletWatches.clear();
  for (const [k, v] of nextWallets) walletWatches.set(k, v);

  // Subscribe to: mints (catches all swaps) + wallets
  const accounts = [...nextByMint.keys(), ...nextWallets.keys()];
  console.log(
    `[worker] watching ${nextByMint.size} mints (${nextPools.size} pools) + ${nextWallets.size} wallets`
  );
  stream.resubscribe(accounts);
}

async function onSignature(account: string, signature: string, err: unknown) {
  if (err) return;
  if (seenSignatures.has(signature)) return;
  seenSignatures.set(signature, Date.now());

  const pairsForMint = poolsByMint.get(account) ?? [];
  const wallet = walletWatches.get(account);
  if (pairsForMint.length === 0 && !wallet) return;

  let txn: unknown;
  try {
    txn = await getTransaction(signature);
  } catch (e) {
    console.error(`[fetch-fail] ${(e as Error).message}`);
    return;
  }
  if (!txn) return;

  for (const pairAddress of pairsForMint) {
    const pool = poolWatches.get(pairAddress);
    if (pool) await handlePool(pool, txn);
  }
  if (wallet) await handleWallet(account, wallet, txn);
}

async function handlePool(pool: PoolWatch, txn: unknown) {
  const event = detectSwap(txn as never, pool.pair);
  if (!event) return;

  if (config.debug) {
    console.log(
      `[swap] ${event.symbol} ${event.side} $${event.amountUsd.toFixed(2)} by ${event.buyer.slice(0, 6)}...`
    );
  }

  const alertedUserIds: string[] = [];
  const alertIdByUser = new Map<string, string | null>();
  let triggeredKind: 'whale_buy' | 'cluster_buy' | null = null;

  for (const userId of pool.userIds) {
    const minUsd = pool.minUsdByUser.get(userId) ?? config.whaleMinUsd;
    const alert = evaluateBuy(event, minUsd, `${event.pairAddress}:${userId}`);
    if (!alert) continue;
    triggeredKind = alert.reason;
    console.log(
      `[alert ${alert.reason}] ${event.symbol} ${event.side} $${event.amountUsd.toFixed(0)} → user=${userId.slice(0, 6)}`
    );
    const alertId = await insertAlert({
      user_id: userId,
      kind: alert.reason,
      chain: event.chain,
      pair_address: event.pairAddress,
      payload: {
        ...event,
        reason: alert.reason,
        clusterCount: alert.clusterCount,
        clusterTotalUsd: alert.clusterTotalUsd,
      } as unknown as Record<string, unknown>,
    });
    alertedUserIds.push(userId);
    alertIdByUser.set(userId, alertId);
    const chatId = await getTelegramChatId(userId);
    if (chatId) await sendAlert(chatId, alert);
  }

  if (alertedUserIds.length > 0 && triggeredKind) {
    await openPositionsForUsers({
      userIds: alertedUserIds,
      chain: event.chain,
      pairAddress: event.pairAddress,
      tokenSymbol: event.symbol,
      entryPriceUsd: pool.pair.priceUsd,
      signalKind: triggeredKind,
      alertIdByUser,
    });
  }
}

const walletCooldown = new Map<string, number>();

async function handleWallet(walletAddr: string, watch: WalletWatch, txn: unknown) {
  const activity = detectWalletActivity(txn as never, walletAddr);
  if (!activity) return;

  for (const userId of watch.userIds) {
    const key = `${walletAddr}:${userId}`;
    const last = walletCooldown.get(key) ?? 0;
    if (Date.now() - last < 60_000) continue;
    walletCooldown.set(key, Date.now());

    if (config.debug) {
      console.log(
        `[wallet-activity] ${watch.label ?? walletAddr.slice(0, 6)} ${activity.side} sig=${activity.signature.slice(0, 12)}`
      );
    }

    await insertAlert({
      user_id: userId,
      kind: 'wallet_activity',
      chain: 'solana',
      pair_address: walletAddr,
      payload: {
        wallet: walletAddr,
        label: watch.label,
        side: activity.side,
        signature: activity.signature,
        changes: activity.changes.slice(0, 5),
      } as unknown as Record<string, unknown>,
    });
    const chatId = await getTelegramChatId(userId);
    if (chatId) await sendWalletActivity(chatId, activity, watch.label);
  }
  // Note: wallet_activity doesn't auto-open paper trade because mint is uncertain
  // and price lookup per mint would slow down the worker. User can opt in later.
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
  setInterval(() => monitorOpenTrades().catch(console.error), 30_000);
  setInterval(pruneSignatures, 60_000);
  setInterval(pruneAll, 60_000);
  setInterval(() => {
    const cutoff = Date.now() - 5 * 60_000;
    for (const [k, ts] of walletCooldown) if (ts < cutoff) walletCooldown.delete(k);
  }, 60_000);

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
