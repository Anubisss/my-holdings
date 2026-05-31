import Big from 'big.js';

import type { Account, Holding, HoldingQuote } from '../types';

/** Total amount paid for a holding (per-share purchase price * shares), as a string. */
export const holdingCostBasis = (holding: Holding): string =>
  new Big(holding.purchasePrice).times(holding.amount).toString();

export type UniqueHolding = { ticker: string; quote: HoldingQuote };

/**
 * Collapses every holding across all accounts down to the unique tickers, keyed
 * by ticker, so a symbol held in several accounts is priced once. Sorted A→Z.
 */
export const uniqueHoldings = (accounts: Account[]): UniqueHolding[] => {
  const byTicker = new Map<string, HoldingQuote>();
  for (const account of accounts) {
    for (const holding of account.holdings) {
      if (!byTicker.has(holding.ticker)) byTicker.set(holding.ticker, holding.quote);
    }
  }

  return [...byTicker.entries()]
    .map(([ticker, quote]) => ({ ticker, quote }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
};
