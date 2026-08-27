import { config } from '../config.js';
import type { Currency } from '../config.js';
import { db } from '../db/client.js';
import { accounts, holdings, watchlist } from '../db/schema.js';
import type { WatchlistRow } from '../db/schema.js';
import type { SummaryDto, WatchlistItemDto } from '../serialize.js';
import { toSummaryDto, toWatchlistItemDto } from '../serialize.js';
import { logger } from './logger.js';
import { getQuotes, withFxTicker } from './quotes.js';
import type { Quote } from './quotes.js';
import { sendTelegramMessage } from './telegram.js';

const sortKey = (row: WatchlistRow): string => (row.displayName ?? row.ticker).toLowerCase();

const orderWatchlist = (rows: WatchlistRow[]): WatchlistRow[] =>
  [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return sortKey(a).localeCompare(sortKey(b));
  });

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtMoneyRounded = (value: string | null, currency: Currency): string => {
  if (value === null) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const fmtSignedMoneyRounded = (value: string | null, currency: Currency): string => {
  if (value === null) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    signDisplay: 'always',
  }).format(num);
};

const fmtPercent = (value: number | null): string => {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const resolveQuoteCurrency = (quoteCurrency: string | null | undefined): Currency | null => {
  if (!quoteCurrency) return null;
  const code = quoteCurrency.toUpperCase();
  if (config.primaryCurrency.code.toUpperCase() === code) return config.primaryCurrency;
  const sec = config.secondaryCurrency;
  if (sec && sec.code.toUpperCase() === code) return sec;
  return null;
};

const fmtPrice = (value: string | null, quoteCurrency?: string | null): string => {
  if (value === null) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';

  const resolved = resolveQuoteCurrency(quoteCurrency);
  if (resolved && resolved.code !== config.primaryCurrency.code) {
    return new Intl.NumberFormat(resolved.locale, {
      style: 'currency',
      currency: resolved.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  const abs = Math.abs(num);
  const maxDecimals = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
  return '$' + formatted;
};

const fmtRate = (value: string | null, currency: Currency): string => {
  if (value === null) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export type NotificationData = {
  summary: SummaryDto;
  watchlistItems: WatchlistItemDto[];
  quotes?: Map<string, Quote>;
  dateStr: string;
};

const changeCircle = (percent: number | null): string => {
  if (percent === null || percent === 0) return '\u26AA';
  return percent > 0 ? '\u{1F7E2}' : '\u{1F534}';
};

const extremeEmoji = (percent: number | null): string => {
  if (percent === null) return '';
  if (percent >= 5) return ' \u{1F680}';
  if (percent <= -5) return ' \u26A0\uFE0F';
  return '';
};

/**
 * Formats the daily notification message as Telegram HTML.
 * Exported so the test script can call it with mock data.
 */
export const formatNotificationHtml = (data: NotificationData): string => {
  const { summary, watchlistItems, quotes, dateStr } = data;
  const primary = config.primaryCurrency;
  const secondary = config.secondaryCurrency;
  const lines: string[] = [];

  // --- Header ---
  lines.push(`\u{1F4C5} <b>Daily Report</b> ${esc(dateStr)}`);
  if (config.portfolioUrl) {
    lines.push(`<a href="${esc(config.portfolioUrl)}">Open MyHoldings</a>`);
  }
  lines.push('');

  // --- Portfolio ---
  const dayChangePct = summary.totals.holdings.dayChangePercent;
  lines.push(`\u{1F4CA} <b>Portfolio</b> ${changeCircle(dayChangePct)}`);

  const pvPrimary = fmtMoneyRounded(summary.totals.portfolioValue, primary);
  const pvSecondary = secondary
    ? fmtMoneyRounded(summary.totals.portfolioValueSecondary, secondary)
    : null;

  lines.push(` ${esc(pvPrimary)}${pvSecondary ? ` ${esc(pvSecondary)}` : ''}`);

  const dayChange = summary.totals.holdings.dayChange;
  const dayPrimary = fmtSignedMoneyRounded(dayChange, primary);
  const daySecondary = secondary
    ? fmtSignedMoneyRounded(summary.totals.holdings.dayChangeSecondary, secondary)
    : null;

  lines.push(
    ` ${esc(dayPrimary)} ${fmtPercent(dayChangePct)}${daySecondary ? ` ${esc(daySecondary)}` : ''}${extremeEmoji(dayChangePct)}`,
  );
  lines.push('');

  // --- FX Change ---
  if (secondary && summary.secondaryCash) {
    const rate = summary.secondaryCash.rate;
    const ratePct = summary.secondaryCash.ratePercent;
    const rateTicker = summary.secondaryCash.rateTicker ?? '';
    const fxValue = summary.totals.currencyChange
      ? fmtSignedMoneyRounded(summary.totals.currencyChange.value, secondary)
      : null;

    const displayName = watchlistItems.find(
      (w) => w.ticker.toUpperCase() === rateTicker.toUpperCase(),
    )?.displayName;
    const fxLabel = displayName ?? rateTicker.replace(/=X$/i, '');

    lines.push(`<b>\u{1F4B5} ${esc(fxLabel)}</b> ${changeCircle(ratePct)}`);
    lines.push(
      ` ${fmtRate(rate, secondary)} ${fmtPercent(ratePct)}${fxValue ? ` ${esc(fxValue)}` : ''}${extremeEmoji(ratePct)}`,
    );
    lines.push('');
  }

  // --- Watchlist ---
  const pinned = watchlistItems.filter((item) => item.pinned);
  const unpinned = watchlistItems.filter((item) => !item.pinned);

  if (pinned.length > 0) {
    lines.push('<b>\u{2B50} Pinned Watchlist</b>');
    for (const item of pinned) {
      lines.push(formatWatchlistLine(item));
      const ext = formatExtendedLine(item);
      if (ext) lines.push(ext);
    }
    lines.push('');
  }

  if (unpinned.length > 0) {
    lines.push('<b>\u{1F440} Watchlist</b>');
    for (const item of unpinned) {
      lines.push(formatWatchlistLine(item));
      const ext = formatExtendedLine(item);
      if (ext) lines.push(ext);
    }
    lines.push('');
  }

  // --- Holdings ---
  if (summary.stocks.length > 0) {
    lines.push('<b>\u{1F4BC} Holdings</b>');
    for (const stock of summary.stocks) {
      const quote = quotes?.get(stock.ticker.toUpperCase());
      const price = fmtPrice(stock.price, quote?.currency);
      const pct = fmtPercent(stock.dayChangePercent);
      lines.push(
        ` ${changeCircle(stock.dayChangePercent)} ${esc(stock.ticker)} ${esc(price)} ${pct}${extremeEmoji(stock.dayChangePercent)}`,
      );

      if (quote?.extendedPrice !== null && quote?.extendedPrice !== undefined) {
        const extPrice = fmtPrice(quote.extendedPrice.toString(), quote.currency);
        const extPct = fmtPercent(quote.extendedChangePercent);
        lines.push(
          `    \u{1F319} ${esc(extPrice)} ${extPct}${extremeEmoji(quote.extendedChangePercent)}`,
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
};

const formatWatchlistLine = (item: WatchlistItemDto): string => {
  const { quote } = item;
  const name = item.displayName ?? item.ticker;
  const price = fmtPrice(quote.price, quote.currency);
  const pct = fmtPercent(quote.dayChangePercent);

  return ` ${changeCircle(quote.dayChangePercent)} ${esc(name)} ${esc(price)} ${pct}${extremeEmoji(quote.dayChangePercent)}`;
};

const formatExtendedLine = (item: WatchlistItemDto): string | null => {
  const { quote } = item;
  if (quote.extendedPrice === null) return null;

  const extPrice = fmtPrice(quote.extendedPrice, quote.currency);
  const extPct = fmtPercent(quote.extendedChangePercent);
  return `    \u{1F319} ${esc(extPrice)} ${extPct}${extremeEmoji(quote.extendedChangePercent)}`;
};

/**
 * Fetches live data and sends the daily Telegram notification.
 * Best-effort: logs errors but never throws.
 */
export const sendDailyNotification = async (dateStr: string): Promise<void> => {
  if (!config.telegram) return;

  try {
    const allAccounts = db.select().from(accounts).all();
    const allHoldings = db.select().from(holdings).all();
    const watchlistRows = orderWatchlist(db.select().from(watchlist).all());

    const holdingTickers = allHoldings.map((h) => h.ticker);
    const watchlistTickers = watchlistRows.map((w) => w.ticker);
    const allTickers = [...new Set([...holdingTickers, ...watchlistTickers])];

    const quotes = allTickers.length > 0 ? await getQuotes(withFxTicker(allTickers)) : undefined;

    const summary = toSummaryDto(allAccounts, allHoldings, quotes, config);
    const watchlistDtos = watchlistRows.map((row) =>
      toWatchlistItemDto(row, quotes?.get(row.ticker.toUpperCase())),
    );

    const html = formatNotificationHtml({
      summary,
      watchlistItems: watchlistDtos,
      quotes,
      dateStr,
    });
    await sendTelegramMessage(html);
  } catch (error) {
    logger.error({ err: error, date: dateStr }, 'Failed to send daily notification');
  }
};
