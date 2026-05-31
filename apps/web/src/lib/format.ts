import Big from 'big.js';

import type { AppConfig, Currency } from '../types';

export type CurrencyAffix = {
  symbol: string;
  position: 'prefix' | 'suffix';
};

/**
 * Uses the platform's locale data to determine whether a currency's symbol is
 * written before (prefix, e.g. "$100") or after (suffix, e.g. "100 Ft") the
 * amount. The configured symbol is returned rather than the locale's own symbol,
 * so callers can keep using their preferred glyph.
 */
export const getCurrencyAffix = (currency: Currency): CurrencyAffix => {
  const parts = new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
  }).formatToParts(1);

  const currencyIndex = parts.findIndex((part) => part.type === 'currency');
  const numberIndex = parts.findIndex(
    (part) => part.type === 'integer' || part.type === 'decimal' || part.type === 'fraction',
  );

  return {
    symbol: currency.symbol,
    position: currencyIndex !== -1 && currencyIndex < numberIndex ? 'prefix' : 'suffix',
  };
};

/**
 * Maps a currency to the matching `Field` adornment prop, so an input shows the
 * symbol on the correct side (e.g. `{ prefix: '$' }` vs `{ suffix: 'Ft' }`).
 */
export const currencyFieldProps = (currency: Currency): { prefix: string } | { suffix: string } => {
  const { symbol, position } = getCurrencyAffix(currency);
  return position === 'prefix' ? { prefix: symbol } : { suffix: symbol };
};

/**
 * Formats a money string for a given currency using locale-aware grouping,
 * decimals, and symbol placement. The configured symbol is substituted for the
 * locale's own currency symbol. Falls back to the raw value if it cannot be parsed.
 */
export const formatMoney = (value: string | null, currency: Currency): string | null => {
  if (value === null || value.trim() === '') return null;

  let amount: number;
  try {
    amount = new Big(value).toNumber();
  } catch {
    return `${currency.symbol}${value}`;
  }

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(amount)
    .map((part) => (part.type === 'currency' ? currency.symbol : part.value))
    .join('');
};

/**
 * Like {@link formatMoney}, but rounds to whole units (no decimals), e.g.
 * "$1,130,000". Used for the hover tooltips behind compact secondary-currency
 * figures, where cent-level precision isn't meaningful.
 */
export const formatRoundedMoney = (value: string | null, currency: Currency): string | null => {
  if (value === null || value.trim() === '') return null;

  let amount: number;
  try {
    amount = new Big(value).toNumber();
  } catch {
    return `${currency.symbol}${value}`;
  }

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .formatToParts(amount)
    .map((part) => (part.type === 'currency' ? currency.symbol : part.value))
    .join('');
};

/** Like {@link formatRoundedMoney}, but always shows an explicit sign for gains. */
export const formatSignedRoundedMoney = (
  value: string | null,
  currency: Currency,
): string | null => {
  const formatted = formatRoundedMoney(value, currency);
  if (formatted === null || value === null) return formatted;

  try {
    if (new Big(value).gt(0)) return `+${formatted}`;
  } catch {
    return formatted;
  }
  return formatted;
};

/**
 * Abbreviates a non-negative number with `k`/`M` suffixes. Millions keep up to
 * two decimals with trailing zeros dropped (e.g. 10000000 -> "10M", 1130000 ->
 * "1.13M"); thousands are rounded to whole units (e.g. 25340 -> "25k"). Values
 * below 1000 are returned plainly (e.g. 523.4 -> "523.4"); only the magnitude
 * that's "needed" is shown.
 */
const abbreviateAmount = (amount: number): string => {
  if (amount >= 1_000_000) {
    // Round to 2 decimals; Number's toString drops any trailing zeros for us.
    return `${Math.round((amount / 1_000_000) * 100) / 100}M`;
  }
  if (amount >= 1_000) {
    // Thousands are abbreviated without decimals (e.g. 25340 -> "25k").
    return `${Math.round(amount / 1_000)}k`;
  }
  return `${Math.round(amount * 100) / 100}`;
};

/** Places a currency's configured symbol on the side its locale prefers. */
const withCurrencyAffix = (numberText: string, currency: Currency): string => {
  const { symbol, position } = getCurrencyAffix(currency);
  return position === 'prefix' ? `${symbol}${numberText}` : `${numberText} ${symbol}`;
};

/**
 * Like {@link formatMoney}, but renders a compact, abbreviated amount
 * (e.g. "$1.13M", "€25.34k") suitable for tight sub-lines. Pair it with
 * {@link formatMoney} to surface the full value on hover. The sign is placed
 * before the symbol (e.g. "-$1.13M"). Falls back to {@link formatMoney} when the
 * value can't be parsed.
 */
export const formatCompactMoney = (value: string | null, currency: Currency): string | null => {
  if (value === null || value.trim() === '') return null;

  let amount: number;
  try {
    amount = new Big(value).toNumber();
  } catch {
    return formatMoney(value, currency);
  }

  const sign = amount < 0 ? '-' : '';
  return `${sign}${withCurrencyAffix(abbreviateAmount(Math.abs(amount)), currency)}`;
};

/** Like {@link formatCompactMoney}, but always shows an explicit sign for gains. */
export const formatSignedCompactMoney = (
  value: string | null,
  currency: Currency,
): string | null => {
  const formatted = formatCompactMoney(value, currency);
  if (formatted === null || value === null) return formatted;

  try {
    if (new Big(value).gt(0)) return `+${formatted}`;
  } catch {
    return formatted;
  }
  return formatted;
};

/**
 * Resolves a Yahoo quote's currency code to one of the configured currencies
 * (primary or secondary) when it matches, so prices render with the user's
 * preferred symbol and locale. Returns null when the code isn't configured.
 */
export const resolveQuoteCurrency = (
  quoteCurrency: string | null,
  config: AppConfig,
): Currency | null => {
  if (!quoteCurrency) return null;
  const code = quoteCurrency.toUpperCase();

  if (config.primaryCurrency.code.toUpperCase() === code) return config.primaryCurrency;

  const { secondaryCurrency } = config;
  if (secondaryCurrency && secondaryCurrency.code.toUpperCase() === code) return secondaryCurrency;

  return null;
};

/** Formats a numeric string with locale grouping and two decimals (no currency). */
const formatPlainAmount = (value: string, locale: string): string | null => {
  let amount: number;
  try {
    amount = new Big(value).toNumber();
  } catch {
    return null;
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Formats a Yahoo price. When the quote's currency is the primary or secondary
 * currency, it renders with that currency's configured symbol/locale. Any other
 * currency is shown as the plain amount with the raw quote currency code as a
 * suffix (e.g. "355.83 EUR") — no symbol lookup. When the quote carries no
 * currency, falls back to the primary currency's formatting.
 */
export const formatQuoteMoney = (
  value: string | null,
  quoteCurrency: string | null,
  config: AppConfig,
): string | null => {
  if (value === null || value.trim() === '') return null;

  const matched = resolveQuoteCurrency(quoteCurrency, config);
  if (matched) return formatMoney(value, matched);

  if (quoteCurrency) {
    const code = quoteCurrency.toUpperCase();
    const amount = formatPlainAmount(value, config.primaryCurrency.locale);
    return `${amount ?? value} ${code}`;
  }

  return formatMoney(value, config.primaryCurrency);
};

/** Like {@link formatQuoteMoney}, but always shows an explicit sign for gains. */
export const formatSignedQuoteMoney = (
  value: string | null,
  quoteCurrency: string | null,
  config: AppConfig,
): string | null => {
  const formatted = formatQuoteMoney(value, quoteCurrency, config);
  if (formatted === null || value === null) return formatted;

  try {
    if (new Big(value).gt(0)) return `+${formatted}`;
  } catch {
    return formatted;
  }
  return formatted;
};

/**
 * Like {@link formatMoney}, but always shows an explicit sign so gains/losses
 * read clearly (e.g. "+$12.50", "-$3.00"). Zero is rendered without a sign.
 */
export const formatSignedMoney = (value: string | null, currency: Currency): string | null => {
  const formatted = formatMoney(value, currency);
  if (formatted === null || value === null) return formatted;

  try {
    if (new Big(value).gt(0)) return `+${formatted}`;
  } catch {
    return formatted;
  }
  return formatted;
};

/** Formats a percentage number with an explicit sign and two decimals. */
export const formatSignedPercent = (value: number | null): string | null => {
  if (value === null) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

/**
 * Tailwind text-color classes for a signed figure: green for gains, red for
 * losses, neutral slate for zero / no change (legible on light and dark).
 */
export const signColorClass = (value: number | null): string => {
  if (value === null || value === 0) return 'text-slate-500 dark:text-slate-400';
  return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
};

/** Numeric sign (-1, 0, 1) of a money string, tolerant of unparseable input. */
export const signOf = (value: string | null): number => {
  if (value === null) return 0;
  try {
    return new Big(value).cmp(0);
  } catch {
    return 0;
  }
};

/** Removes thousands separators so a masked money input can be parsed/stored. */
export const unmaskMoney = (value: string): string => value.replace(/,/g, '');

/**
 * Masks free user input for a money field: keeps digits and a single decimal
 * point, strips leading zeros, and adds thousands separators to the integer
 * part while the user types.
 */
export const maskMoneyInput = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const intDigits = (firstDot === -1 ? cleaned : cleaned.slice(0, firstDot)).replace(
    /^0+(?=\d)/,
    '',
  );
  const intWithSeparators = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (firstDot === -1) return intWithSeparators;

  const decDigits = cleaned.slice(firstDot + 1).replace(/\./g, '');
  return `${intWithSeparators === '' ? '0' : intWithSeparators}.${decDigits}`;
};
