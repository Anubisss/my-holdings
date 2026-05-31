import Big from 'big.js';

import { unmaskMoney } from './format';

export const validateAccountName = (name: string): string | null => {
  const trimmed = name.trim();

  if (trimmed.length < 1) return 'Name is required';
  if (trimmed.length > 64) return 'Name must be at most 64 characters';

  return null;
};

/** Keeps letters and dashes (for class shares like `BRK-B`); uppercases the rest. */
export const sanitizeHoldingTicker = (value: string): string =>
  value.replace(/[^A-Za-z-]/g, '').toUpperCase();

export const validateTicker = (ticker: string): string | null => {
  const trimmed = ticker.trim();

  if (trimmed.length < 1) return 'Ticker is required';
  if (trimmed.length > 14) return 'Ticker must be at most 14 characters';
  if (!/^[A-Za-z]+(-[A-Za-z]+)?$/.test(trimmed)) {
    return 'Letters, with an optional single dash (e.g. BRK-B)';
  }

  return null;
};

/** Allowed characters in a watchlist ticker (FX/indices/crypto, e.g. `^GSPC`, `BTC-USD`). */
export const sanitizeWatchlistTicker = (value: string): string =>
  value.replace(/[^A-Za-z0-9.^=-]/g, '').toUpperCase();

export const validateWatchlistTicker = (ticker: string): string | null => {
  const trimmed = ticker.trim();

  if (trimmed.length < 1) return 'Ticker is required';
  if (trimmed.length > 20) return 'Ticker must be at most 20 characters';
  if (!/^[A-Za-z0-9.^=-]+$/.test(trimmed)) return 'Only letters, numbers, and . ^ = -';

  return null;
};

export const validateAmount = (amount: string): string | null => {
  if (amount.trim() === '') return 'Amount is required';
  if (!/^\d+$/.test(amount.trim())) return 'Amount must be a whole number';

  const value = Number.parseInt(amount, 10);
  if (value < 1) return 'Amount must be at least 1';
  if (value > 99999) return 'Amount must be at most 99999';

  return null;
};

/** Validates a strictly positive price string (accepts masked input). */
export const validatePrice = (price: string): string | null => {
  const value = unmaskMoney(price).trim();
  if (value === '') return 'Price is required';

  try {
    const big = new Big(value);
    if (big.lte(0)) return 'Price must be greater than 0';
    return null;
  } catch {
    return 'Price must be a number';
  }
};

/** Validates a non-negative cash amount string (accepts masked input; empty = cleared). */
export const validateCash = (cash: string): string | null => {
  const value = unmaskMoney(cash).trim();
  if (value === '') return null;

  try {
    const big = new Big(value);
    if (big.lt(0)) return 'Cash must be 0 or greater';
    return null;
  } catch {
    return 'Cash must be a number';
  }
};
