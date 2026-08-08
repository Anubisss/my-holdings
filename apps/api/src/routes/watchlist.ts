import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { db } from '../db/client.js';
import { watchlist, type WatchlistRow } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { pruneOrphanNote } from '../lib/notes.js';
import { getQuotes } from '../lib/quotes.js';
import { createWatchlistItemSchema, idParamSchema, updateWatchlistItemSchema } from '../schemas.js';
import { toWatchlistItemDto } from '../serialize.js';

// Items sort by display name (falling back to the ticker), but pinned items
// always come first.
const sortKey = (row: WatchlistRow): string => (row.displayName ?? row.ticker).toLowerCase();

const orderWatchlist = (rows: WatchlistRow[]): WatchlistRow[] =>
  [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return sortKey(a).localeCompare(sortKey(b));
  });

export const registerWatchlistRoutes = (app: FastifyInstance): void => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get('/api/watchlist', async () => {
    const rows = orderWatchlist(db.select().from(watchlist).all());
    const quotes = await getQuotes(rows.map((row) => row.ticker));

    return rows.map((row) => toWatchlistItemDto(row, quotes.get(row.ticker.toUpperCase())));
  });

  typed.post(
    '/api/watchlist',
    { schema: { body: createWatchlistItemSchema } },
    async (request, reply) => {
      const id = randomUUID();
      const timestamp = new Date().toISOString();
      db.insert(watchlist)
        .values({
          id,
          ticker: request.body.ticker,
          displayName: request.body.displayName ?? null,
          pinned: request.body.pinned ?? false,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();

      request.log.info({ watchlistId: id, ticker: request.body.ticker }, 'Created watchlist item');

      const created = db.select().from(watchlist).where(eq(watchlist.id, id)).get();

      reply.code(201);
      if (!created) return null;

      const quotes = await getQuotes([created.ticker]);

      return toWatchlistItemDto(created, quotes.get(created.ticker.toUpperCase()));
    },
  );

  typed.patch(
    '/api/watchlist/:id',
    { schema: { params: idParamSchema, body: updateWatchlistItemSchema } },
    async (request) => {
      const existing = db.select().from(watchlist).where(eq(watchlist.id, request.params.id)).get();
      if (!existing) throw notFound('Watchlist item not found');

      db.update(watchlist)
        .set({
          ticker: request.body.ticker,
          displayName: request.body.displayName ?? null,
          pinned: request.body.pinned ?? false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(watchlist.id, request.params.id))
        .run();

      request.log.info(
        { watchlistId: request.params.id, ticker: request.body.ticker },
        'Updated watchlist item',
      );

      if (existing.ticker !== request.body.ticker) pruneOrphanNote(existing.ticker);

      const updated = db.select().from(watchlist).where(eq(watchlist.id, request.params.id)).get();
      if (!updated) return null;

      const quotes = await getQuotes([updated.ticker]);

      return toWatchlistItemDto(updated, quotes.get(updated.ticker.toUpperCase()));
    },
  );

  typed.delete(
    '/api/watchlist/:id',
    { schema: { params: idParamSchema } },
    async (request, reply) => {
      const existing = db.select().from(watchlist).where(eq(watchlist.id, request.params.id)).get();
      if (!existing) throw notFound('Watchlist item not found');

      db.delete(watchlist).where(eq(watchlist.id, request.params.id)).run();

      request.log.info({ watchlistId: request.params.id }, 'Deleted watchlist item');

      pruneOrphanNote(existing.ticker);

      reply.code(204);
      return null;
    },
  );
};
