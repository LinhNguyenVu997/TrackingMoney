import { config } from './config.js';
import type { SwapEvent } from './detector.js';

export type AlertReason = 'whale_buy' | 'cluster_buy';

export interface Alert {
  reason: AlertReason;
  event: SwapEvent;
  clusterCount?: number;
  clusterTotalUsd?: number;
}

interface BuyEntry {
  ts: number;
  usd: number;
}

const recentBuys = new Map<string, BuyEntry[]>();
const lastAlertAt = new Map<string, number>();

function pruneOld(pool: string, now: number) {
  const arr = recentBuys.get(pool);
  if (!arr) return;
  const cutoff = now - config.clusterWindowSec * 1000;
  const fresh = arr.filter((e) => e.ts >= cutoff);
  if (fresh.length === 0) recentBuys.delete(pool);
  else recentBuys.set(pool, fresh);
}

export function evaluateBuy(event: SwapEvent): Alert | null {
  if (event.side !== 'buy') return null;

  const now = Date.now();
  const pool = event.pairAddress;

  const lastAlert = lastAlertAt.get(pool) ?? 0;
  if (now - lastAlert < config.cooldownSec * 1000) return null;

  if (event.amountUsd >= config.whaleMinUsd) {
    lastAlertAt.set(pool, now);
    return { reason: 'whale_buy', event };
  }

  if (event.amountUsd >= config.clusterMinUsd) {
    pruneOld(pool, now);
    const arr = recentBuys.get(pool) ?? [];
    arr.push({ ts: now, usd: event.amountUsd });
    recentBuys.set(pool, arr);

    if (arr.length >= config.clusterCount) {
      const total = arr.reduce((s, e) => s + e.usd, 0);
      lastAlertAt.set(pool, now);
      recentBuys.delete(pool);
      return {
        reason: 'cluster_buy',
        event,
        clusterCount: arr.length,
        clusterTotalUsd: total,
      };
    }
  }

  return null;
}

export function pruneAll() {
  const now = Date.now();
  for (const pool of recentBuys.keys()) pruneOld(pool, now);
  const cooldownCutoff = now - config.cooldownSec * 1000;
  for (const [pool, ts] of lastAlertAt) {
    if (ts < cooldownCutoff) lastAlertAt.delete(pool);
  }
}
