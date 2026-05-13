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

function pruneOld(key: string, now: number) {
  const arr = recentBuys.get(key);
  if (!arr) return;
  const cutoff = now - config.clusterWindowSec * 1000;
  const fresh = arr.filter((e) => e.ts >= cutoff);
  if (fresh.length === 0) recentBuys.delete(key);
  else recentBuys.set(key, fresh);
}

export function evaluateBuy(event: SwapEvent, minUsd: number, cooldownKey: string): Alert | null {
  if (event.side !== 'buy') return null;

  const now = Date.now();
  const lastAlert = lastAlertAt.get(cooldownKey) ?? 0;
  if (now - lastAlert < config.cooldownSec * 1000) return null;

  if (event.amountUsd >= minUsd) {
    lastAlertAt.set(cooldownKey, now);
    return { reason: 'whale_buy', event };
  }

  if (event.amountUsd >= config.clusterMinUsd) {
    pruneOld(cooldownKey, now);
    const arr = recentBuys.get(cooldownKey) ?? [];
    arr.push({ ts: now, usd: event.amountUsd });
    recentBuys.set(cooldownKey, arr);

    if (arr.length >= config.clusterCount) {
      const total = arr.reduce((s, e) => s + e.usd, 0);
      lastAlertAt.set(cooldownKey, now);
      recentBuys.delete(cooldownKey);
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
  for (const key of recentBuys.keys()) pruneOld(key, now);
  const cooldownCutoff = now - config.cooldownSec * 1000;
  for (const [key, ts] of lastAlertAt) {
    if (ts < cooldownCutoff) lastAlertAt.delete(key);
  }
}
