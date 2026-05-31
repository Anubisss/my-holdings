import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { config } from '../config.js';
import { db } from '../db/client.js';
import { accounts, holdings } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getQuotes, withFxTicker } from '../lib/quotes.js';
import {
  createAccountSchema,
  createHoldingSchema,
  idParamSchema,
  updateAccountSchema,
  updateCashSchema,
} from '../schemas.js';
import { resolveFx, toAccountDto, toHoldingDto } from '../serialize.js';

const loadAccountDto = async (id: string) => {
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) return null;

  const accountHoldings = db.select().from(holdings).where(eq(holdings.accountId, id)).all();
  const quotes = await getQuotes(withFxTicker(accountHoldings.map((holding) => holding.ticker)));

  return toAccountDto(account, accountHoldings, quotes, config);
};

export const registerAccountRoutes = (app: FastifyInstance): void => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get('/api/accounts', async () => {
    const allAccounts = db.select().from(accounts).all();
    const allHoldings = db.select().from(holdings).all();
    const byAccount = new Map<string, typeof allHoldings>();

    for (const holding of allHoldings) {
      const list = byAccount.get(holding.accountId) ?? [];
      list.push(holding);
      list.sort((a, b) => a.ticker.localeCompare(b.ticker));
      byAccount.set(holding.accountId, list);
    }

    const quotes = await getQuotes(withFxTicker(allHoldings.map((holding) => holding.ticker)));

    return allAccounts
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((account) => toAccountDto(account, byAccount.get(account.id) ?? [], quotes, config));
  });

  typed.post('/api/accounts', { schema: { body: createAccountSchema } }, async (request, reply) => {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    db.insert(accounts)
      .values({
        id,
        name: request.body.name,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    request.log.info({ accountId: id, name: request.body.name }, 'Created account');

    reply.code(201);
    return loadAccountDto(id);
  });

  typed.patch(
    '/api/accounts/:id',
    { schema: { params: idParamSchema, body: updateAccountSchema } },
    async (request) => {
      const existing = db.select().from(accounts).where(eq(accounts.id, request.params.id)).get();
      if (!existing) throw notFound('Account not found');

      db.update(accounts)
        .set({ name: request.body.name, updatedAt: new Date().toISOString() })
        .where(eq(accounts.id, request.params.id))
        .run();

      request.log.info(
        { accountId: request.params.id, name: request.body.name },
        'Updated account',
      );

      return loadAccountDto(request.params.id);
    },
  );

  typed.delete(
    '/api/accounts/:id',
    { schema: { params: idParamSchema } },
    async (request, reply) => {
      const existing = db.select().from(accounts).where(eq(accounts.id, request.params.id)).get();
      if (!existing) throw notFound('Account not found');

      // Holdings are removed via ON DELETE CASCADE.
      db.delete(accounts).where(eq(accounts.id, request.params.id)).run();

      request.log.info({ accountId: request.params.id }, 'Deleted account');

      reply.code(204);
      return null;
    },
  );

  typed.put(
    '/api/accounts/:id/cash',
    { schema: { params: idParamSchema, body: updateCashSchema } },
    async (request) => {
      const existing = db.select().from(accounts).where(eq(accounts.id, request.params.id)).get();
      if (!existing) throw notFound('Account not found');

      const { primary, secondary } = request.body;
      if (secondary !== undefined && secondary !== null && !config.secondaryCurrency) {
        throw badRequest('Secondary currency is not configured');
      }

      const update: Partial<typeof accounts.$inferInsert> = {
        updatedAt: new Date().toISOString(),
      };
      if (primary !== undefined) update.cashPrimary = primary;
      if (secondary !== undefined) update.cashSecondary = secondary;

      db.update(accounts).set(update).where(eq(accounts.id, request.params.id)).run();

      request.log.info(
        { accountId: request.params.id, primary, secondary },
        'Updated account cash',
      );

      return loadAccountDto(request.params.id);
    },
  );

  typed.post(
    '/api/accounts/:id/holdings',
    { schema: { params: idParamSchema, body: createHoldingSchema } },
    async (request, reply) => {
      const account = db.select().from(accounts).where(eq(accounts.id, request.params.id)).get();
      if (!account) throw notFound('Account not found');

      const id = randomUUID();
      const timestamp = new Date().toISOString();
      db.insert(holdings)
        .values({
          id,
          accountId: request.params.id,
          ticker: request.body.ticker,
          purchaseDate: request.body.purchaseDate,
          amount: request.body.amount,
          purchasePrice: request.body.purchasePrice,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();

      request.log.info(
        { holdingId: id, accountId: request.params.id, ticker: request.body.ticker },
        'Created holding',
      );

      const created = db.select().from(holdings).where(eq(holdings.id, id)).get();

      reply.code(201);
      if (!created) return null;

      const quotes = await getQuotes(withFxTicker([created.ticker]));

      return toHoldingDto(
        created,
        resolveFx(quotes, config),
        quotes.get(created.ticker.toUpperCase()),
      );
    },
  );
};
