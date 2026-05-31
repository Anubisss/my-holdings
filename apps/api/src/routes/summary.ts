import type { FastifyInstance } from 'fastify';

import { config } from '../config.js';
import { db } from '../db/client.js';
import { accounts, holdings } from '../db/schema.js';
import { getQuotes, withFxTicker } from '../lib/quotes.js';
import { toSummaryDto } from '../serialize.js';

export const registerSummaryRoutes = (app: FastifyInstance): void => {
  app.get('/api/summary', async () => {
    const allAccounts = db.select().from(accounts).all();
    const allHoldings = db.select().from(holdings).all();

    const quotes = await getQuotes(withFxTicker(allHoldings.map((holding) => holding.ticker)));

    return toSummaryDto(allAccounts, allHoldings, quotes, config);
  });
};
