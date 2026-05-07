import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import { consumeLinkCode, upsertTelegramLink } from './supabase.js';
import type { Alert } from './signals.js';

const bot = new TelegramBot(config.telegramBotToken, { polling: true });

bot.onText(/\/start(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = String(msg.chat.id);
  const code = match?.[1];
  if (!code) {
    await bot.sendMessage(
      chatId,
      'Welcome to Whale Tracker. Open the app → Settings → Link Telegram to receive alerts.'
    );
    return;
  }
  const userId = await consumeLinkCode(code);
  if (!userId) {
    await bot.sendMessage(chatId, 'Invalid or expired code. Generate a new one in the app.');
    return;
  }
  await upsertTelegramLink(userId, chatId);
  await bot.sendMessage(chatId, '✅ Linked. You will receive buy alerts here.');
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

export function stopBot() {
  bot.stopPolling();
}
