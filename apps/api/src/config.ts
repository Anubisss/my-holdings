export type Currency = {
  code: string;
  symbol: string;
  locale: string;
};

export type TelegramConfig = { botToken: string; chatId: string };

export type AppConfig = {
  port: number;
  host: string;
  dbPath: string;
  primaryCurrency: Currency;
  secondaryCurrency: Currency | null;
  secondaryRateTicker: string | null;
  portfolioValueHistoryEnabled: boolean;
  telegram: TelegramConfig | null;
  portfolioUrl: string | null;
};

/** USD is always the primary (base) currency. */
const PRIMARY_CURRENCY: Currency = { code: 'USD', symbol: '$', locale: 'en-US' };

type SecondaryConfig = { currency: Currency; rateTicker: string | null };

/**
 * Parses `SECONDARY_CURRENCY` in the form "CODE,SYMBOL,LOCALE"
 * (e.g. "HUF,Ft,hu-HU").
 */
const parseSecondaryCurrency = (raw: string | undefined): SecondaryConfig | null => {
  if (!raw) return null;

  const [code, symbol, locale] = raw.split(',').map((part) => part.trim());
  if (!code || !symbol) return null;

  return {
    currency: { code: code.toUpperCase(), symbol, locale },
    rateTicker: `${PRIMARY_CURRENCY.code.toUpperCase()}${code.toUpperCase()}=X`,
  };
};

const parseTelegram = (): TelegramConfig | null => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
};

export const loadConfig = (): AppConfig => {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const secondary = parseSecondaryCurrency(process.env.SECONDARY_CURRENCY);

  const pvhRaw = process.env.PORTFOLIO_VALUE_HISTORY_ENABLED;
  const portfolioValueHistoryEnabled = pvhRaw === undefined || pvhRaw.toLowerCase() === 'true';

  const portfolioUrl = process.env.TELEGRAM_OPEN_MY_HOLDINGS_URL?.trim() || null;

  return {
    port: Number.isNaN(port) ? 3000 : port,
    host: process.env.HOST ?? '0.0.0.0',
    dbPath: process.env.DB_PATH ?? './data/dev.db',
    primaryCurrency: PRIMARY_CURRENCY,
    secondaryCurrency: secondary?.currency ?? null,
    secondaryRateTicker: secondary?.rateTicker ?? null,
    portfolioValueHistoryEnabled,
    telegram: parseTelegram(),
    portfolioUrl,
  };
};

export const config = loadConfig();
