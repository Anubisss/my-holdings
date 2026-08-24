import Big from 'big.js';

import type { AppConfig } from '../config.js';
import type { AccountRow } from '../db/schema.js';
import type { Quote } from './quotes.js';

const round2 = (value: Big): number => Number(value.round(2).toString());

/**
 * Resolved FX state for a request. `rate` is how many units of the secondary
 * currency equal 1 unit of the primary (the `secondaryRateTicker` price), so
 * primary -> secondary multiplies by it and secondary -> primary divides by it.
 * Both fields are null when no secondary currency is configured or the FX quote
 * is unavailable, which makes every conversion collapse to null.
 */
export type Fx = {
  rate: Big | null;
  /** Today's regular-session change of the rate, in secondary units per primary. */
  change: Big | null;
  ratePercent: number | null;
};

const NO_FX: Fx = { rate: null, change: null, ratePercent: null };

/** Builds the {@link Fx} state from the configured FX ticker's live quote. */
export const resolveFx = (quotes: Map<string, Quote> | undefined, config: AppConfig): Fx => {
  if (!config.secondaryCurrency || !config.secondaryRateTicker) return NO_FX;

  const quote = quotes?.get(config.secondaryRateTicker.toUpperCase());
  const rate = quote && quote.valid && quote.price ? new Big(quote.price) : null;
  const change = rate && quote && quote.change !== null ? new Big(quote.change) : null;
  const ratePercent =
    rate && quote && quote.changePercent !== null ? round2(new Big(quote.changePercent)) : null;

  return { rate, change, ratePercent };
};

/** Converts a primary-currency amount to the secondary currency (value * rate). */
export const toSecondary = (value: Big | string | null, fx: Fx): string | null => {
  if (value === null || fx.rate === null) return null;
  return new Big(value).times(fx.rate).toString();
};

/** Converts a secondary-currency amount to the primary currency (value / rate). */
export const toPrimary = (value: Big | string | null, fx: Fx): string | null => {
  if (value === null || fx.rate === null || fx.rate.lte(0)) return null;
  return new Big(value).div(fx.rate).toString();
};

export const sumCash = (rows: AccountRow[], pick: (row: AccountRow) => string | null): Big =>
  rows.reduce((total, row) => {
    const raw = pick(row);
    if (!raw) return total;
    try {
      return total.plus(new Big(raw));
    } catch {
      return total;
    }
  }, new Big(0));
