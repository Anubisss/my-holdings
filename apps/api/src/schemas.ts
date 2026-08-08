import { z } from 'zod';

import { isTodayOrEarlier } from './lib/date.js';
import { normalizeMoney, normalizePrice } from './lib/money.js';

export const accountNameSchema = z
  .string()
  .trim()
  .min(1, 'Name must be at least 1 character')
  .max(64, 'Name must be at most 64 characters');

export const tickerSchema = z
  .string()
  .trim()
  .min(1, 'Ticker must be at least 1 character')
  .max(14, 'Ticker must be at most 14 characters')
  .regex(
    /^[A-Za-z]+(-[A-Za-z]+)?$/,
    'Ticker must be letters, with an optional single dash (e.g. BRK-B)',
  )
  .transform((value) => value.toUpperCase());

/**
 * Watchlist tickers are more permissive than holdings: they can be FX pairs,
 * indices or crypto (e.g. "EURUSD=X", "^GSPC", "BTC-USD"), so digits and the
 * `. ^ = -` symbols are allowed in addition to letters.
 */
export const watchlistTickerSchema = z
  .string()
  .trim()
  .min(1, 'Ticker must be at least 1 character')
  .max(20, 'Ticker must be at most 20 characters')
  .regex(/^[A-Za-z0-9.^=-]+$/, 'Ticker may contain only letters, numbers, and . ^ = -')
  .transform((value) => value.toUpperCase());

/** Optional friendly label for a watchlist item; empty string clears it to null. */
export const displayNameSchema = z
  .string()
  .trim()
  .max(64, 'Display name must be at most 64 characters')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const noteBodySchema = z.string().trim().max(2000, 'Note must be maximum 2000 characters');

export const amountSchema = z
  .number()
  .int('Amount must be a whole number')
  .min(1, 'Amount must be at least 1')
  .max(99999, 'Amount must be at most 99999');

export const purchaseDateSchema = z
  .string()
  .refine(isTodayOrEarlier, 'Date must be a valid date of today or earlier');

export const priceSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePrice(value);
  if (normalized === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price must be a positive number' });
    return z.NEVER;
  }
  return normalized;
});

/** A nullable money amount (>= 0). `null` clears the value. */
export const cashAmountSchema = z
  .string()
  .nullable()
  .transform((value, ctx) => {
    if (value === null) return null;
    const normalized = normalizeMoney(value);
    if (normalized === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cash must be a number of 0 or greater',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const createAccountSchema = z.object({
  name: accountNameSchema,
});

export const updateAccountSchema = z.object({
  name: accountNameSchema,
});

export const updateCashSchema = z
  .object({
    primary: cashAmountSchema.optional(),
    secondary: cashAmountSchema.optional(),
  })
  .refine((data) => data.primary !== undefined || data.secondary !== undefined, {
    message: 'At least one of primary or secondary must be provided',
  });

export const createHoldingSchema = z.object({
  ticker: tickerSchema,
  purchaseDate: purchaseDateSchema,
  amount: amountSchema,
  purchasePrice: priceSchema,
});

export const updateHoldingSchema = createHoldingSchema;

export const createWatchlistItemSchema = z.object({
  ticker: watchlistTickerSchema,
  displayName: displayNameSchema,
  pinned: z.boolean().optional(),
});

export const updateWatchlistItemSchema = z.object({
  ticker: watchlistTickerSchema,
  displayName: displayNameSchema,
  pinned: z.boolean().optional(),
});

export const updateNoteSchema = z.object({
  body: noteBodySchema,
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const tickerParamSchema = z.object({
  ticker: watchlistTickerSchema,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateCashInput = z.infer<typeof updateCashSchema>;
export type CreateHoldingInput = z.infer<typeof createHoldingSchema>;
export type CreateWatchlistItemInput = z.infer<typeof createWatchlistItemSchema>;
