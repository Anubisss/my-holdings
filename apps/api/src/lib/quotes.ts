import YahooFinance from 'yahoo-finance2';

import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * A normalized quote for a single ticker. `valid` is false when Yahoo Finance
 * has no data for the symbol (e.g. a typo'd / delisted ticker).
 */
export type Quote = {
  ticker: string;
  valid: boolean;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
  marketState: string | null;
  isMarketOpen: boolean;
  /** Pre/after-hours price; populated during a pre (PRE/PREPRE) or post (POST/POSTPOST) session. */
  extendedPrice: number | null;
  extendedChange: number | null;
  extendedChangePercent: number | null;
};

const TTL_MS = 70_000;

// When a fresh fetch comes back invalid, we keep serving the last valid quote
// for up to this long before falling back to the invalid quote.
// 15 minutes
const STALE_FALLBACK_MS = 15 * 60_000;

type CacheEntry = { quote: Quote; storedAt: number; expiresAt: number };

const cache = new Map<string, CacheEntry>();

// A single client instance is reused across requests. `suppressNotices` quiets
// the one-off survey log line the library prints on first use.
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const invalidQuote = (ticker: string): Quote => ({
  ticker,
  valid: false,
  price: null,
  previousClose: null,
  change: null,
  changePercent: null,
  currency: null,
  marketState: null,
  isMarketOpen: false,
  extendedPrice: null,
  extendedChange: null,
  extendedChangePercent: null,
});

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const toQuote = (ticker: string, raw: Record<string, unknown>): Quote => {
  const price = typeof raw.regularMarketPrice === 'number' ? raw.regularMarketPrice : null;
  if (price === null) return invalidQuote(ticker);

  const marketState = typeof raw.marketState === 'string' ? raw.marketState : null;

  // Yahoo exposes a separate price/change block for each extended-hours session.
  // Pick the one matching the current state so callers get a single set of fields.
  const extendedPrice =
    marketState === 'PRE' || marketState === 'PREPRE'
      ? num(raw.preMarketPrice)
      : marketState === 'POST' || marketState === 'POSTPOST'
        ? num(raw.postMarketPrice)
        : null;
  const extendedChange =
    marketState === 'PRE' || marketState === 'PREPRE'
      ? num(raw.preMarketChange)
      : marketState === 'POST' || marketState === 'POSTPOST'
        ? num(raw.postMarketChange)
        : null;
  const extendedChangePercent =
    marketState === 'PRE' || marketState === 'PREPRE'
      ? num(raw.preMarketChangePercent)
      : marketState === 'POST' || marketState === 'POSTPOST'
        ? num(raw.postMarketChangePercent)
        : null;

  return {
    ticker,
    valid: true,
    price,
    previousClose:
      typeof raw.regularMarketPreviousClose === 'number' ? raw.regularMarketPreviousClose : null,
    change: typeof raw.regularMarketChange === 'number' ? raw.regularMarketChange : null,
    changePercent:
      typeof raw.regularMarketChangePercent === 'number' ? raw.regularMarketChangePercent : null,
    currency: typeof raw.currency === 'string' ? raw.currency : null,
    marketState,
    isMarketOpen: marketState === 'REGULAR',
    extendedPrice,
    extendedChange,
    extendedChangePercent,
  };
};

/**
 * Fetches quotes for the given tickers from Yahoo Finance in a single batch
 * request. Symbols Yahoo returns no data for are simply absent from the result
 * map; callers treat those as invalid. Network/parse failures resolve to an
 * empty map so a transient outage never crashes the request.
 */
const fetchQuotes = async (tickers: string[]): Promise<Map<string, Quote>> => {
  const result = new Map<string, Quote>();
  if (tickers.length === 0) return result;

  try {
    const raw = await yahooFinance.quote(tickers, { return: 'map' }, { validateResult: false });
    for (const [symbol, data] of raw) {
      const ticker = symbol.toUpperCase();
      result.set(ticker, toQuote(ticker, data as Record<string, unknown>));
    }
  } catch (error) {
    // Leave `result` empty; every requested ticker falls back to invalid.
    logger.error({ err: error, tickers }, 'Failed to fetch quotes from Yahoo Finance');
  }

  return result;
};

/**
 * Returns the given tickers plus the configured FX rate ticker (when a secondary
 * currency is configured), so secondary-currency conversions can be computed in
 * the same batch quote request.
 */
export const withFxTicker = (tickers: string[]): string[] =>
  config.secondaryRateTicker ? [...tickers, config.secondaryRateTicker] : tickers;

/**
 * Resolves quotes for the given tickers, deduplicating and serving from an
 * in-memory cache with a 70s TTL. Only the tickers missing (or expired) from
 * the cache hit the network. Returns a map keyed by uppercase ticker that is
 * guaranteed to contain an entry for every requested ticker.
 */
export const getQuotes = async (tickers: string[]): Promise<Map<string, Quote>> => {
  const unique = [...new Set(tickers.map((ticker) => ticker.toUpperCase()))];
  const now = Date.now();
  const result = new Map<string, Quote>();
  const misses: string[] = [];

  for (const ticker of unique) {
    const entry = cache.get(ticker);
    if (entry && entry.expiresAt > now) {
      result.set(ticker, entry.quote);
    } else {
      misses.push(ticker);
    }
  }

  if (misses.length > 0) {
    const fetched = await fetchQuotes(misses);
    for (const ticker of misses) {
      const quote = fetched.get(ticker);

      if (quote?.valid) {
        cache.set(ticker, { quote, storedAt: now, expiresAt: now + TTL_MS });
        result.set(ticker, quote);
        continue;
      }

      // Fresh quote is invalid (or missing). If we still hold a recent valid
      // quote, keep serving it and leave the cache untouched.
      const existing = cache.get(ticker);
      if (existing?.quote.valid && now - existing.storedAt <= STALE_FALLBACK_MS) {
        result.set(ticker, existing.quote);
        continue;
      }

      // No usable cached value: return and cache the invalid quote.
      const invalid = quote ?? invalidQuote(ticker);
      cache.set(ticker, { quote: invalid, storedAt: now, expiresAt: now + TTL_MS });
      result.set(ticker, invalid);
    }
  }

  return result;
};
