import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { config } from '../config.js';
import { db } from '../db/client.js';
import { holdings } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { pruneOrphanNote } from '../lib/notes.js';
import { getQuotes, withFxTicker } from '../lib/quotes.js';
import { idParamSchema, updateHoldingSchema } from '../schemas.js';
import { resolveFx, toHoldingDto } from '../serialize.js';

export const registerHoldingRoutes = (app: FastifyInstance): void => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.patch(
    '/api/holdings/:id',
    { schema: { params: idParamSchema, body: updateHoldingSchema } },
    async (request) => {
      const existing = db.select().from(holdings).where(eq(holdings.id, request.params.id)).get();
      if (!existing) throw notFound('Holding not found');

      db.update(holdings)
        .set({
          ticker: request.body.ticker,
          purchaseDate: request.body.purchaseDate,
          amount: request.body.amount,
          purchasePrice: request.body.purchasePrice,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(holdings.id, request.params.id))
        .run();

      request.log.info(
        { holdingId: request.params.id, ticker: request.body.ticker },
        'Updated holding',
      );

      if (existing.ticker !== request.body.ticker) pruneOrphanNote(existing.ticker);

      const updated = db.select().from(holdings).where(eq(holdings.id, request.params.id)).get();
      if (!updated) return null;

      const quotes = await getQuotes(withFxTicker([updated.ticker]));

      return toHoldingDto(
        updated,
        resolveFx(quotes, config),
        quotes.get(updated.ticker.toUpperCase()),
      );
    },
  );

  typed.delete(
    '/api/holdings/:id',
    { schema: { params: idParamSchema } },
    async (request, reply) => {
      const existing = db.select().from(holdings).where(eq(holdings.id, request.params.id)).get();
      if (!existing) throw notFound('Holding not found');

      db.delete(holdings).where(eq(holdings.id, request.params.id)).run();

      request.log.info({ holdingId: request.params.id }, 'Deleted holding');

      pruneOrphanNote(existing.ticker);

      reply.code(204);
      return null;
    },
  );
};
