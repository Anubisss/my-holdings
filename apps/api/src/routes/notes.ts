import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { db } from '../db/client.js';
import { notes } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { isTickerTracked } from '../lib/notes.js';
import { tickerParamSchema, updateNoteSchema } from '../schemas.js';

export const registerNoteRoutes = (app: FastifyInstance): void => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get('/api/notes', async () => {
    const rows = db.select().from(notes).all();

    return Object.fromEntries(rows.map((row) => [row.ticker, row.body]));
  });

  typed.put(
    '/api/notes/:ticker',
    { schema: { params: tickerParamSchema, body: updateNoteSchema } },
    async (request, reply) => {
      const { ticker } = request.params;
      const { body } = request.body;

      if (body === '') {
        db.delete(notes).where(eq(notes.ticker, ticker)).run();
        request.log.info({ ticker }, 'Deleted note');
      } else {
        if (!isTickerTracked(ticker)) {
          throw notFound(`${ticker} is not in your holdings or watchlist`);
        }

        const timestamp = new Date().toISOString();
        db.insert(notes)
          .values({ ticker, body, createdAt: timestamp, updatedAt: timestamp })
          .onConflictDoUpdate({ target: notes.ticker, set: { body, updatedAt: timestamp } })
          .run();
        request.log.info({ ticker }, 'Saved note');
      }

      reply.code(204);
      return null;
    },
  );
};
