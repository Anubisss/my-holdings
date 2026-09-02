import Big from 'big.js';

import type { AppConfig } from './config.js';
import type { AccountRow, HoldingRow, WatchlistRow } from './db/schema.js';
import { type Fx, resolveFx, sumCash, toPrimary, toSecondary } from './lib/portfolio.js';
import type { Quote } from './lib/quotes.js';

export { type Fx, resolveFx, sumCash, toPrimary, toSecondary };

/** Live pricing for a single ticker, shared by holdings and watchlist items. */
export type PriceQuoteDto = {
  /** False when the ticker has no Yahoo Finance data (likely invalid). */
  valid: boolean;
  marketState: string | null;
  isMarketOpen: boolean;
  /** Current per-share price in the quote currency (USD for US equities). */
  price: string | null;
  currency: string | null;
  /** Regular-session per-share change vs the prior close; present in every market state. */
  dayChange: string | null;
  dayChangePercent: number | null;
  /** Pre/after-hours price; only present during a pre (PRE/PREPRE) or post (POST/POSTPOST) session. */
  extendedPrice: string | null;
  extendedChange: string | null;
  extendedChangePercent: number | null;
};

/** Per-holding pricing: the shared price fields plus position value and return. */
export type HoldingQuoteDto = PriceQuoteDto & {
  /** amount * current price. */
  currentValue: string | null;
  /** `currentValue` converted to the secondary currency, or null. */
  currentValueSecondary: string | null;
  /** (current price - purchase price) * amount. */
  returnValue: string | null;
  /** `returnValue` converted to the secondary currency, or null. */
  returnValueSecondary: string | null;
  returnPercent: number | null;
};

export type HoldingDto = {
  id: string;
  accountId: string;
  ticker: string;
  purchaseDate: string;
  amount: number;
  purchasePrice: string;
  /** purchasePrice * amount converted to the secondary currency, or null. */
  costBasisSecondary: string | null;
  createdAt: string;
  updatedAt: string;
  quote: HoldingQuoteDto;
};

export type AccountDto = {
  id: string;
  name: string;
  cashPrimary: string | null;
  /** `cashPrimary` converted to the secondary currency, or null. */
  cashPrimarySecondary: string | null;
  cashSecondary: string | null;
  /** `cashSecondary` converted to the primary currency, or null. */
  cashSecondaryPrimary: string | null;
  createdAt: string;
  updatedAt: string;
  holdings: HoldingDto[];
};

const round2 = (value: Big): number => Number(value.round(2).toString());

const buildPriceQuoteDto = (quote?: Quote): PriceQuoteDto => {
  if (!quote || !quote.valid || quote.price === null) {
    return {
      valid: quote?.valid ?? false,
      marketState: quote?.marketState ?? null,
      isMarketOpen: quote?.isMarketOpen ?? false,
      price: null,
      currency: quote?.currency ?? null,
      dayChange: null,
      dayChangePercent: null,
      extendedPrice: null,
      extendedChange: null,
      extendedChangePercent: null,
    };
  }

  // The regular-session change (vs the prior close) is always shown when Yahoo
  // provides it, regardless of market state. While the market is open it tracks
  // today's move; pre-market, after-hours, and when the market is closed it
  // reflects the most recent completed trading day. Any extended-hours move is
  // surfaced separately via the extended* fields.
  const showDayChange = quote.change !== null;
  // Extended-hours pricing is only meaningful during a pre (PRE/PREPRE) or
  // post (POST/POSTPOST) session.
  const showExtended = !quote.isMarketOpen && quote.extendedPrice !== null;

  return {
    valid: true,
    marketState: quote.marketState,
    isMarketOpen: quote.isMarketOpen,
    price: new Big(quote.price).toString(),
    currency: quote.currency,
    dayChange: showDayChange ? new Big(quote.change as number).toString() : null,
    dayChangePercent:
      showDayChange && quote.changePercent !== null ? round2(new Big(quote.changePercent)) : null,
    extendedPrice: showExtended ? new Big(quote.extendedPrice as number).toString() : null,
    extendedChange:
      showExtended && quote.extendedChange !== null
        ? new Big(quote.extendedChange).toString()
        : null,
    extendedChangePercent:
      showExtended && quote.extendedChangePercent !== null
        ? round2(new Big(quote.extendedChangePercent))
        : null,
  };
};

const buildHoldingQuoteDto = (row: HoldingRow, fx: Fx, quote?: Quote): HoldingQuoteDto => {
  const base = buildPriceQuoteDto(quote);
  if (!base.valid || base.price === null) {
    return {
      ...base,
      currentValue: null,
      currentValueSecondary: null,
      returnValue: null,
      returnValueSecondary: null,
      returnPercent: null,
    };
  }

  const price = new Big(base.price);
  const amount = new Big(row.amount);
  const purchasePrice = new Big(row.purchasePrice);

  const currentValue = price.times(amount);
  const returnValue = price.minus(purchasePrice).times(amount);
  const returnPercent = purchasePrice.eq(0)
    ? null
    : round2(price.minus(purchasePrice).div(purchasePrice).times(100));

  return {
    ...base,
    currentValue: currentValue.toString(),
    currentValueSecondary: toSecondary(currentValue, fx),
    returnValue: returnValue.toString(),
    returnValueSecondary: toSecondary(returnValue, fx),
    returnPercent,
  };
};

export const toHoldingDto = (row: HoldingRow, fx: Fx, quote?: Quote): HoldingDto => ({
  id: row.id,
  accountId: row.accountId,
  ticker: row.ticker,
  purchaseDate: row.purchaseDate,
  amount: row.amount,
  purchasePrice: row.purchasePrice,
  costBasisSecondary: toSecondary(new Big(row.purchasePrice).times(row.amount), fx),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  quote: buildHoldingQuoteDto(row, fx, quote),
});

export const toAccountDto = (
  row: AccountRow,
  holdingRows: HoldingRow[],
  quotes: Map<string, Quote> | undefined,
  config: AppConfig,
): AccountDto => {
  const fx = resolveFx(quotes, config);
  return {
    id: row.id,
    name: row.name,
    cashPrimary: row.cashPrimary,
    cashPrimarySecondary: toSecondary(row.cashPrimary, fx),
    cashSecondary: row.cashSecondary,
    cashSecondaryPrimary: toPrimary(row.cashSecondary, fx),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    holdings: holdingRows.map((holding) =>
      toHoldingDto(holding, fx, quotes?.get(holding.ticker.toUpperCase())),
    ),
  };
};

export type WatchlistItemDto = {
  id: string;
  ticker: string;
  displayName: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  quote: PriceQuoteDto;
};

export const toWatchlistItemDto = (row: WatchlistRow, quote?: Quote): WatchlistItemDto => ({
  id: row.id,
  ticker: row.ticker,
  displayName: row.displayName,
  pinned: row.pinned,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  quote: buildPriceQuoteDto(quote),
});

/** A unique stock position aggregated across every account. */
export type SummaryStockDto = {
  ticker: string;
  /** Total shares held across all accounts. */
  amount: number;
  /** Total paid (sum of purchasePrice * shares) across all accounts, in USD. */
  costBasis: string;
  /** `costBasis` converted to the secondary currency, or null. */
  costBasisSecondary: string | null;
  /** Weighted-average purchase price per share (costBasis / amount), in USD. */
  averageCost: string | null;
  /** Current per-share price in USD, or null when the quote is unavailable. */
  price: string | null;
  /** amount * price, or null when the quote is unavailable. */
  marketValue: string | null;
  /** `marketValue` converted to the secondary currency, or null. */
  marketValueSecondary: string | null;
  /** marketValue - costBasis, or null when the quote is unavailable. */
  returnValue: string | null;
  /** `returnValue` converted to the secondary currency, or null. */
  returnValueSecondary: string | null;
  returnPercent: number | null;
  /** Today's regular-session change for the whole position (per-share change * amount). */
  dayChange: string | null;
  /** `dayChange` converted to the secondary currency, or null. */
  dayChangeSecondary: string | null;
  /** Regular-session percent change vs the prior close (equals the per-share %). */
  dayChangePercent: number | null;
  /** False when the ticker has no valid Yahoo Finance price. */
  valid: boolean;
};

/** Aggregated cash for one currency bucket. */
export type SummaryCashDto = {
  code: string;
  symbol: string;
  locale: string;
  /** Total cash in this bucket's own currency. */
  value: string;
  /** `value` converted to the secondary currency, or null (used for primary cash). */
  valueSecondary: string | null;
};

/** Secondary cash also carries its USD conversion and the FX rate used. */
export type SummarySecondaryCashDto = SummaryCashDto & {
  /** `value` converted to USD (value / rate), or null when no rate is available. */
  valuePrimary: string | null;
  /** Units of the secondary currency per 1 USD, or null when unavailable. */
  rate: string | null;
  /** Regular-session change of the FX rate vs the prior close, as a percent. */
  ratePercent: number | null;
  rateTicker: string | null;
};

export type SummaryDto = {
  stocks: SummaryStockDto[];
  primaryCash: SummaryCashDto;
  secondaryCash: SummarySecondaryCashDto | null;
  totals: {
    /**
     * Stock holdings only (cash excluded), so the return reflects investment
     * performance and isn't diluted by cash sitting at a zero return.
     */
    holdings: {
      /** Sum of every stock's cost basis (in USD). */
      costBasis: string;
      /** `costBasis` converted to the secondary currency, or null. */
      costBasisSecondary: string | null;
      /** Sum of every stock's market value (in USD). */
      marketValue: string;
      /** `marketValue` converted to the secondary currency, or null. */
      marketValueSecondary: string | null;
      /** marketValue - costBasis. */
      returnValue: string;
      /** `returnValue` converted to the secondary currency, or null. */
      returnValueSecondary: string | null;
      /** returnValue / costBasis * 100, or 0 when there is no cost basis. */
      returnPercent: number;
      /** Sum of every stock's day change; today's market move on the holdings. */
      dayChange: string;
      /** `dayChange` converted to the secondary currency, or null. */
      dayChangeSecondary: string | null;
      /** dayChange / (marketValue - dayChange) * 100 (prior-close basis), or 0. */
      dayChangePercent: number;
    };
    /**
     * Whole-portfolio return with cash counted in the basis: cash earns no
     * return, so the value equals the holdings return, but the percent is
     * diluted by cash sitting in the portfolio.
     */
    totalReturn: {
      /** portfolioValue - (holdings cost basis + all cash in primary). */
      value: string;
      /** `value` converted to the secondary currency, or null. */
      valueSecondary: string | null;
      /** value / (holdings cost basis + all cash in primary) * 100, or 0. */
      percent: number;
    };
    /** Holdings market value plus all cash, converted to the primary currency. */
    portfolioValue: string;
    /** `portfolioValue` converted to the secondary currency, or null. */
    portfolioValueSecondary: string | null;
    /**
     * Money gained/lost in the secondary currency from today's FX move on the
     * primary-denominated portion of the portfolio, with the FX day-change
     * percent that drove it. Null when no secondary currency / FX rate.
     */
    currencyChange: { value: string; percent: number } | null;
  };
};

const buildSummaryStock = (
  ticker: string,
  rows: HoldingRow[],
  fx: Fx,
  quote?: Quote,
): SummaryStockDto => {
  let amount = 0;
  let costBasis = new Big(0);
  for (const row of rows) {
    amount += row.amount;
    costBasis = costBasis.plus(new Big(row.purchasePrice).times(row.amount));
  }

  const valid = Boolean(quote && quote.valid && quote.price !== null);
  const price = valid ? new Big(quote!.price as number) : null;
  const marketValue = price ? price.times(amount) : null;
  const returnValue = marketValue ? marketValue.minus(costBasis) : null;
  const returnPercent =
    returnValue && costBasis.gt(0) ? round2(returnValue.div(costBasis).times(100)) : null;

  // Today's move scaled to the whole position; the per-share percent applies
  // unchanged to the position.
  const dayChangePerShare = valid && quote!.change !== null ? new Big(quote!.change) : null;
  const dayChange = dayChangePerShare ? dayChangePerShare.times(amount) : null;
  const dayChangePercent =
    valid && quote!.changePercent !== null ? round2(new Big(quote!.changePercent)) : null;

  return {
    ticker,
    amount,
    costBasis: costBasis.toString(),
    costBasisSecondary: toSecondary(costBasis, fx),
    averageCost: amount > 0 ? costBasis.div(amount).toString() : null,
    price: price ? price.toString() : null,
    marketValue: marketValue ? marketValue.toString() : null,
    marketValueSecondary: toSecondary(marketValue, fx),
    returnValue: returnValue ? returnValue.toString() : null,
    returnValueSecondary: toSecondary(returnValue, fx),
    returnPercent,
    dayChange: dayChange ? dayChange.toString() : null,
    dayChangeSecondary: toSecondary(dayChange, fx),
    dayChangePercent,
    valid,
  };
};

/**
 * Builds the whole-portfolio summary: unique stock positions aggregated across
 * every account, cash per currency (with the secondary converted to USD), a
 * holdings total covering the stocks (cost basis, market value, return), and a
 * single portfolio value of holdings market value plus all cash.
 */
export const toSummaryDto = (
  accountRows: AccountRow[],
  holdingRows: HoldingRow[],
  quotes: Map<string, Quote> | undefined,
  config: AppConfig,
): SummaryDto => {
  const byTicker = new Map<string, HoldingRow[]>();
  for (const holding of holdingRows) {
    const key = holding.ticker.toUpperCase();
    const list = byTicker.get(key) ?? [];
    list.push(holding);
    byTicker.set(key, list);
  }

  const { primaryCurrency, secondaryCurrency, secondaryRateTicker } = config;
  const fx = resolveFx(quotes, config);

  const stocks: SummaryStockDto[] = [];
  let stocksCostBasis = new Big(0);
  let stocksMarketValue = new Big(0);
  let stocksDayChange = new Big(0);
  for (const [ticker, rows] of [...byTicker.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const stock = buildSummaryStock(ticker, rows, fx, quotes?.get(ticker));
    stocks.push(stock);
    stocksCostBasis = stocksCostBasis.plus(stock.costBasis);
    // Fall back to cost basis when a price is unavailable so an invalid ticker
    // doesn't silently drop value from the grand total (it nets to zero return).
    stocksMarketValue = stocksMarketValue.plus(stock.marketValue ?? stock.costBasis);
    // Invalid / quote-less tickers contribute no day change.
    stocksDayChange = stocksDayChange.plus(stock.dayChange ?? 0);
  }

  const primaryTotal = sumCash(accountRows, (row) => row.cashPrimary);
  const primaryCash: SummaryCashDto = {
    code: primaryCurrency.code,
    symbol: primaryCurrency.symbol,
    locale: primaryCurrency.locale,
    value: primaryTotal.toString(),
    valueSecondary: toSecondary(primaryTotal, fx),
  };

  let secondaryCash: SummarySecondaryCashDto | null = null;
  let secondaryInPrimary = new Big(0);
  if (secondaryCurrency) {
    const secondaryTotal = sumCash(accountRows, (row) => row.cashSecondary);
    const valuePrimary = toPrimary(secondaryTotal, fx);
    if (valuePrimary) secondaryInPrimary = new Big(valuePrimary);
    secondaryCash = {
      code: secondaryCurrency.code,
      symbol: secondaryCurrency.symbol,
      locale: secondaryCurrency.locale,
      value: secondaryTotal.toString(),
      valueSecondary: null,
      valuePrimary,
      rate: fx.rate ? fx.rate.toString() : null,
      ratePercent: fx.ratePercent,
      rateTicker: secondaryRateTicker,
    };
  }

  const holdingsReturn = stocksMarketValue.minus(stocksCostBasis);
  const holdingsReturnPercent = stocksCostBasis.gt(0)
    ? round2(holdingsReturn.div(stocksCostBasis).times(100))
    : 0;

  // Day change percent is measured against the prior-close value of the
  // holdings (current market value minus today's change).
  const holdingsPriorValue = stocksMarketValue.minus(stocksDayChange);
  const holdingsDayChangePercent = holdingsPriorValue.gt(0)
    ? round2(stocksDayChange.div(holdingsPriorValue).times(100))
    : 0;

  const allCashInPrimary = primaryTotal.plus(secondaryInPrimary);
  const portfolioValue = stocksMarketValue.plus(allCashInPrimary);

  // Whole-portfolio return: cash sits in both the current value and the basis
  // at a zero return, so the value reduces to the holdings return while the
  // percent is diluted by the cash.
  const portfolioCostBasis = stocksCostBasis.plus(allCashInPrimary);
  const totalReturn = portfolioValue.minus(portfolioCostBasis);
  const totalReturnPercent = portfolioCostBasis.gt(0)
    ? round2(totalReturn.div(portfolioCostBasis).times(100))
    : 0;

  // FX gain/loss in the secondary currency: the primary-denominated portion of
  // the portfolio (everything except the native secondary cash) earns/loses
  // `fx.change` secondary units per primary unit as today's rate moves. Using
  // the rate's absolute change is exact (vs. applying the rounded percent).
  let currencyChange: { value: string; percent: number } | null = null;
  if (fx.change !== null && fx.ratePercent !== null) {
    const primaryPortion = portfolioValue.minus(secondaryInPrimary);
    currencyChange = {
      value: primaryPortion.times(fx.change).toString(),
      percent: fx.ratePercent,
    };
  }

  return {
    stocks,
    primaryCash,
    secondaryCash,
    totals: {
      holdings: {
        costBasis: stocksCostBasis.toString(),
        costBasisSecondary: toSecondary(stocksCostBasis, fx),
        marketValue: stocksMarketValue.toString(),
        marketValueSecondary: toSecondary(stocksMarketValue, fx),
        returnValue: holdingsReturn.toString(),
        returnValueSecondary: toSecondary(holdingsReturn, fx),
        returnPercent: holdingsReturnPercent,
        dayChange: stocksDayChange.toString(),
        dayChangeSecondary: toSecondary(stocksDayChange, fx),
        dayChangePercent: holdingsDayChangePercent,
      },
      totalReturn: {
        value: totalReturn.toString(),
        valueSecondary: toSecondary(totalReturn, fx),
        percent: totalReturnPercent,
      },
      portfolioValue: portfolioValue.toString(),
      portfolioValueSecondary: toSecondary(portfolioValue, fx),
      currencyChange,
    },
  };
};
