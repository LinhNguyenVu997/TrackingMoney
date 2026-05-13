import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import {
  consumeLinkCode,
  upsertTelegramLink,
  supabase,
} from './supabase.js';
import type { Alert } from './signals.js';
import type { WalletActivity } from './wallet-detector.js';

const bot = new TelegramBot(config.telegramBotToken, { polling: true });

async function getUserIdByChat(chatId: string): Promise<string | null> {
  const { data } = await supabase
    .from('telegram_links')
    .select('user_id')
    .eq('chat_id', chatId)
    .maybeSingle();
  return data?.user_id ?? null;
}

bot.onText(/^\/start(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = String(msg.chat.id);
  const code = match?.[1];
  if (!code) {
    await bot.sendMessage(
      chatId,
      'Welcome to Whale Tracker.\nOpen app → Settings → Link Telegram for alerts.\nCommands: /watchlist /wallets /stop /resume /help'
    );
    return;
  }
  const userId = await consumeLinkCode(code);
  if (!userId) {
    await bot.sendMessage(chatId, 'Invalid or expired code. Generate a new one in the app.');
    return;
  }
  await upsertTelegramLink(userId, chatId);
  await bot.sendMessage(chatId, '✅ Linked. Type /help for commands.');
});

bot.onText(/^\/help/, async (msg) => {
  const chatId = String(msg.chat.id);
  await bot.sendMessage(
    chatId,
    [
      '*Commands:*',
      '/watchlist — list your saved coins',
      '/wallets — list tracked wallets',
      '/stop — pause all alerts',
      '/resume — resume alerts',
      '/threshold <USD> — set whale min USD (global)',
    ].join('\n'),
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/^\/watchlist/, async (msg) => {
  const chatId = String(msg.chat.id);
  const userId = await getUserIdByChat(chatId);
  if (!userId) {
    await bot.sendMessage(chatId, 'Not linked. Generate a code in app → Settings.');
    return;
  }
  const { data } = await supabase
    .from('watchlist')
    .select('token_symbol, token_name, active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) {
    await bot.sendMessage(chatId, 'Watchlist is empty.');
    return;
  }
  const lines = data.map(
    (r, i) => `${i + 1}. *${r.token_symbol ?? '?'}* ${r.active ? '' : '(paused)'}`
  );
  await bot.sendMessage(chatId, `*Your watchlist:*\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
  });
});

bot.onText(/^\/wallets/, async (msg) => {
  const chatId = String(msg.chat.id);
  const userId = await getUserIdByChat(chatId);
  if (!userId) {
    await bot.sendMessage(chatId, 'Not linked.');
    return;
  }
  const { data } = await supabase
    .from('tracked_wallets')
    .select('wallet_address, label, active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (!data || data.length === 0) {
    await bot.sendMessage(chatId, 'No tracked wallets.');
    return;
  }
  const lines = data.map(
    (r, i) =>
      `${i + 1}. ${r.label ?? `\`${r.wallet_address.slice(0, 6)}...\``} ${r.active ? '' : '(paused)'}`
  );
  await bot.sendMessage(chatId, `*Tracked wallets:*\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
  });
});

bot.onText(/^\/stop/, async (msg) => {
  const chatId = String(msg.chat.id);
  const userId = await getUserIdByChat(chatId);
  if (!userId) return;
  await supabase.from('watchlist').update({ active: false }).eq('user_id', userId);
  await supabase.from('tracked_wallets').update({ active: false }).eq('user_id', userId);
  await bot.sendMessage(chatId, '⏸ Paused all alerts. Use /resume to re-enable.');
});

bot.onText(/^\/resume/, async (msg) => {
  const chatId = String(msg.chat.id);
  const userId = await getUserIdByChat(chatId);
  if (!userId) return;
  await supabase.from('watchlist').update({ active: true }).eq('user_id', userId);
  await supabase.from('tracked_wallets').update({ active: true }).eq('user_id', userId);
  await bot.sendMessage(chatId, '▶️ Resumed all alerts.');
});

bot.onText(/^\/threshold\s+(\d+)/, async (msg, match) => {
  const chatId = String(msg.chat.id);
  const userId = await getUserIdByChat(chatId);
  if (!userId || !match) return;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    await bot.sendMessage(chatId, 'Usage: /threshold 1000');
    return;
  }
  await supabase.from('watchlist').update({ min_usd: value }).eq('user_id', userId);
  await bot.sendMessage(chatId, `✅ Threshold set to $${value} for all your watchlist.`);
});

export async function sendAlert(chatId: string, alert: Alert) {
  const e = alert.event;
  const header =
    alert.reason === 'whale_buy'
      ? `🐋 *WHALE BUY* — ${e.symbol}`
      : `🟢 *CLUSTER BUY* — ${e.symbol}`;
  const lines = [
    header,
    `$${e.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${e.amountTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${e.symbol})`,
  ];
  if (alert.reason === 'cluster_buy' && alert.clusterCount && alert.clusterTotalUsd) {
    lines.push(
      `_${alert.clusterCount} buys totaling $${alert.clusterTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} in last ${Math.round(config.clusterWindowSec / 60)}m_`
    );
  }
  lines.push(`Wallet: \`${e.buyer}\``);
  lines.push(`[View Tx](https://solscan.io/tx/${e.signature})`);
  try {
    await bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error('[tg] sendMessage error', err);
  }
}

export async function sendWalletActivity(
  chatId: string,
  activity: WalletActivity,
  label: string | null
) {
  const sideEmoji = activity.side === 'buy' ? '🟢' : activity.side === 'sell' ? '🔴' : '⚪';
  const nameLine = label
    ? `*${label}*`
    : `\`${activity.wallet.slice(0, 6)}...${activity.wallet.slice(-4)}\``;
  const lines = [
    `${sideEmoji} *Tracked wallet ${activity.side.toUpperCase()}*`,
    nameLine,
    `Mints: ${activity.changes
      .slice(0, 3)
      .map((c) => `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(2)} of \`${c.mint.slice(0, 4)}...\``)
      .join(', ')}`,
    `[View Tx](https://solscan.io/tx/${activity.signature})`,
  ];
  try {
    await bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error('[tg] sendMessage error', err);
  }
}

export function stopBot() {
  bot.stopPolling();
}
