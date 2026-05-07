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
}

export async function loadWatchlist(): Promise<WatchlistRow[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('user_id, chain, pair_address, token_symbol, token_name');
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

export async function insertAlert(alert: AlertInsert) {
  const { error } = await supabase.from('alerts').insert(alert);
  if (error) console.error('insertAlert error:', error);
}
