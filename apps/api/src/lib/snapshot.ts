import { randomUUID } from 'node:crypto';

import Big from 'big.js';
import { eq } from 'drizzle-orm';

import { config } from '../config.js';
import { db } from '../db/client.js';
import { accounts, holdings, portfolioValueHistory } from '../db/schema.js';
import { toSummaryDto } from '../serialize.js';
import { logger } from './logger.js';
import { getQuotes, withFxTicker } from './quotes.js';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 10_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attempts to calculate and save a portfolio value snapshot for the given date.
 * Throws if the portfolio value cannot be computed (invalid quotes, missing FX
 * rate, or network errors) so the retry wrapper can try again.
 */
const attemptSave = async (dateStr: string): Promise<void> => {
  const existing = db
    .select({ id: portfolioValueHistory.id })
    .from(portfolioValueHistory)
    .where(eq(portfolioValueHistory.date, dateStr))
    .get();

  if (existing) {
    logger.info({ date: dateStr }, 'Snapshot already exists, skipping');
    return;
  }

  const allAccounts = db.select().from(accounts).all();
  const allHoldings = db.select().from(holdings).all();

  const tickers = allHoldings.map((h) => h.ticker);
  const quotes = tickers.length > 0 ? await getQuotes(withFxTicker(tickers)) : undefined;

  const summary = toSummaryDto(allAccounts, allHoldings, quotes, config);

  const invalidTickers = summary.stocks.filter((s) => !s.valid).map((s) => s.ticker);
  if (invalidTickers.length > 0) {
    throw new Error(`Missing/invalid quotes for ${invalidTickers.join(', ')}`);
  }

  const fxUnavailable =
    config.secondaryCurrency !== null &&
    config.secondaryRateTicker !== null &&
    summary.secondaryCash?.rate === null;
  if (fxUnavailable) {
    throw new Error('FX rate unavailable');
  }

  const currencyRate = summary.secondaryCash?.rate ?? null;

  db.insert(portfolioValueHistory)
    .values({
      id: randomUUID(),
      date: dateStr,
      currencyRate,
      valuePrimary: new Big(summary.totals.portfolioValue).toFixed(2),
      valueSecondary: summary.totals.portfolioValueSecondary
        ? new Big(summary.totals.portfolioValueSecondary).toFixed(2)
        : null,
    })
    .run();

  logger.info(
    {
      date: dateStr,
      valuePrimary: summary.totals.portfolioValue,
      valueSecondary: summary.totals.portfolioValueSecondary,
      currencyRate,
    },
    'Portfolio snapshot saved',
  );
};

/**
 * Saves a portfolio value snapshot for the given date with up to
 * {@link MAX_ATTEMPTS} retries using exponential backoff. Logs each failure and
 * emits a final error when all attempts are exhausted.
 */
export const saveSnapshot = async (dateStr: string): Promise<void> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await attemptSave(dateStr);
      break;
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = BACKOFF_BASE_MS * 2 ** (attempt - 1);
        logger.warn(
          { err: error, date: dateStr, attempt, nextRetryMs: delayMs },
          'Snapshot attempt failed, retrying',
        );
        await sleep(delayMs);
      } else {
        logger.error(
          { err: error, date: dateStr, attempt },
          'All snapshot attempts failed — no data saved for this date',
        );
      }
    }
  }
};
