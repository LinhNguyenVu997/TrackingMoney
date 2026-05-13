import {
  loadPaperSettings,
  openPaperTrade,
  loadOpenTrades,
  closePaperTrade,
  type PaperSettingsRow,
} from './supabase.js';
import { fetchPair, getPairMeta } from './dex.js';

export type SignalKind = 'whale_buy' | 'cluster_buy' | 'wallet_activity';

function followsSignal(settings: PaperSettingsRow, kind: SignalKind): boolean {
  if (kind === 'whale_buy') return settings.follow_whale_buy;
  if (kind === 'cluster_buy') return settings.follow_cluster_buy;
  if (kind === 'wallet_activity') return settings.follow_wallet_activity;
  return false;
}

export async function openPositionsForUsers(args: {
  userIds: string[];
  chain: string;
  pairAddress: string;
  tokenSymbol: string | null;
  entryPriceUsd: number;
  signalKind: SignalKind;
  alertIdByUser: Map<string, string | null>;
}) {
  const settings = await loadPaperSettings(args.userIds);
  if (settings.size === 0) return;

  for (const userId of args.userIds) {
    const s = settings.get(userId);
    if (!s || !s.enabled) continue;
    if (!followsSignal(s, args.signalKind)) continue;
    if (args.entryPriceUsd <= 0) continue;

    const amountUsd = s.position_size_usd;
    const tokens = amountUsd / args.entryPriceUsd;

    await openPaperTrade({
      user_id: userId,
      chain: args.chain,
      pair_address: args.pairAddress,
      token_symbol: args.tokenSymbol,
      signal_kind: args.signalKind,
      entry_price: args.entryPriceUsd,
      entry_amount_usd: amountUsd,
      entry_tokens: tokens,
      alert_id: args.alertIdByUser.get(userId) ?? null,
    });

    console.log(
      `[paper] open ${args.tokenSymbol ?? '?'} for user=${userId.slice(0, 6)} $${amountUsd} @ $${args.entryPriceUsd.toFixed(8)}`
    );
  }
}

export async function monitorOpenTrades() {
  const trades = await loadOpenTrades();
  if (trades.length === 0) return;

  const byPair = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = `${t.chain}:${t.pair_address}`;
    const arr = byPair.get(key) ?? [];
    arr.push(t);
    byPair.set(key, arr);
  }

  for (const [key, group] of byPair) {
    const [chain, pairAddress] = key.split(':');
    const meta = (await getPairMeta(chain, pairAddress)) ?? (await fetchPair(chain, pairAddress));
    if (!meta) continue;
    const currentPrice = meta.priceUsd;
    if (!currentPrice || !isFinite(currentPrice)) continue;

    for (const t of group) {
      const settings = await loadPaperSettings([t.user_id]);
      const s = settings.get(t.user_id);
      if (!s) continue;

      const pct = ((currentPrice - t.entry_price) / t.entry_price) * 100;
      const ageHours = (Date.now() - new Date(t.entry_at).getTime()) / 3_600_000;

      let reason: string | null = null;
      if (pct >= s.take_profit_pct) reason = 'take_profit';
      else if (pct <= -s.stop_loss_pct) reason = 'stop_loss';
      else if (ageHours >= s.max_hold_hours) reason = 'max_hold';

      if (reason) {
        await closePaperTrade(t.id, currentPrice, reason, t.entry_amount_usd, t.entry_tokens);
        console.log(
          `[paper] close ${t.token_symbol ?? '?'} ${reason} pnl=${pct.toFixed(2)}%`
        );
      }
    }
  }
}
