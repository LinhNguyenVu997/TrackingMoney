import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface WatchlistRow {
  user_id: string;
  chain: string;
  pair_address: string;
  token_symbol: string | null;
  token_name: string | null;
  min_usd: number | null;
  active: boolean;
}

export async function loadWatchlist(): Promise<WatchlistRow[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('user_id, chain, pair_address, token_symbol, token_name, min_usd, active')
    .eq('active', true);
  if (error) throw error;
  return data ?? [];
}

export interface TrackedWalletRow {
  user_id: string;
  wallet_address: string;
  label: string | null;
  min_usd: number | null;
}

export async function loadTrackedWallets(): Promise<TrackedWalletRow[]> {
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('user_id, wallet_address, label, min_usd')
    .eq('active', true);
  if (error) throw error;
  return data ?? [];
}

export async function getTelegramChatId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('telegram_links')
    .select('chat_id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.chat_id ?? null;
}

export async function consumeLinkCode(code: string): Promise<string | null> {
  const { data: row } = await supabase
    .from('telegram_link_codes')
    .select('user_id, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await supabase.from('telegram_link_codes').delete().eq('code', code);
  return row.user_id;
}

export async function upsertTelegramLink(userId: string, chatId: string) {
  await supabase.from('telegram_links').upsert({ user_id: userId, chat_id: chatId });
}

export interface AlertInsert {
  user_id: string;
  kind: string;
  chain: string;
  pair_address: string;
  payload: Record<string, unknown>;
}

export async function insertAlert(alert: AlertInsert): Promise<string | null> {
  const { data, error } = await supabase.from('alerts').insert(alert).select('id').single();
  if (error) {
    console.error('insertAlert error:', error);
    return null;
  }
  return data?.id ?? null;
}

export interface PaperSettingsRow {
  user_id: string;
  enabled: boolean;
  position_size_usd: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  max_hold_hours: number;
  follow_whale_buy: boolean;
  follow_cluster_buy: boolean;
  follow_wallet_activity: boolean;
}

export async function loadPaperSettings(userIds: string[]): Promise<Map<string, PaperSettingsRow>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('paper_settings')
    .select('user_id, enabled, position_size_usd, stop_loss_pct, take_profit_pct, max_hold_hours, follow_whale_buy, follow_cluster_buy, follow_wallet_activity')
    .in('user_id', userIds)
    .eq('enabled', true);
  const map = new Map<string, PaperSettingsRow>();
  for (const r of (data ?? []) as PaperSettingsRow[]) map.set(r.user_id, r);
  return map;
}

export interface PaperTradeInsert {
  user_id: string;
  chain: string;
  pair_address: string;
  token_symbol: string | null;
  signal_kind: string;
  entry_price: number;
  entry_amount_usd: number;
  entry_tokens: number;
  alert_id: string | null;
}

export async function openPaperTrade(t: PaperTradeInsert) {
  const { error } = await supabase.from('paper_trades').insert(t);
  if (error) console.error('openPaperTrade error:', error);
}

export interface OpenPaperTrade {
  id: string;
  user_id: string;
  chain: string;
  pair_address: string;
  entry_price: number;
  entry_amount_usd: number;
  entry_tokens: number;
  entry_at: string;
  token_symbol: string | null;
}

export async function loadOpenTrades(): Promise<OpenPaperTrade[]> {
  const { data } = await supabase
    .from('paper_trades')
    .select('id, user_id, chain, pair_address, entry_price, entry_amount_usd, entry_tokens, entry_at, token_symbol')
    .eq('status', 'open');
  return (data ?? []) as OpenPaperTrade[];
}

export async function closePaperTrade(
  id: string,
  exitPrice: number,
  exitReason: string,
  entryAmountUsd: number,
  entryTokens: number
) {
  const exitValueUsd = entryTokens * exitPrice;
  const pnlUsd = exitValueUsd - entryAmountUsd;
  const pnlPct = (pnlUsd / entryAmountUsd) * 100;
  const { error } = await supabase
    .from('paper_trades')
    .update({
      exit_price: exitPrice,
      exit_at: new Date().toISOString(),
      exit_reason: exitReason,
      pnl_usd: pnlUsd,
      pnl_pct: pnlPct,
      status: 'closed',
    })
    .eq('id', id);
  if (error) console.error('closePaperTrade error:', error);
}
