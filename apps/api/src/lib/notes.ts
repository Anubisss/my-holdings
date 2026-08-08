import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { holdings, notes, watchlist } from '../db/schema.js';

// True when ticker is held in an account or sits on the watchlist.
export const isTickerTracked = (ticker: string): boolean => {
  const heldSomewhere = db
    .select({ id: holdings.id })
    .from(holdings)
    .where(eq(holdings.ticker, ticker))
    .limit(1)
    .get();
  if (heldSomewhere) return true;

  const watched = db
    .select({ id: watchlist.id })
    .from(watchlist)
    .where(eq(watchlist.ticker, ticker))
    .limit(1)
    .get();

  return Boolean(watched);
};

export const pruneOrphanNote = (ticker: string): void => {
  if (isTickerTracked(ticker)) return;

  db.delete(notes).where(eq(notes.ticker, ticker)).run();
};
