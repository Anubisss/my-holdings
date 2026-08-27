import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Sends an HTML-formatted message to the configured Telegram chat.
 * Best-effort: logs errors but never throws.
 */
export const sendTelegramMessage = async (html: string): Promise<void> => {
  if (!config.telegram) return;

  const { botToken, chatId } = config.telegram;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, 'Telegram sendMessage failed');
    } else {
      logger.info('Telegram notification sent');
    }
  } catch (error) {
    logger.error({ err: error }, 'Telegram sendMessage request error');
  }
};
