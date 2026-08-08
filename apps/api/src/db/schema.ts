import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cashPrimary: text('cash_primary'),
  cashSecondary: text('cash_secondary'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const holdings = sqliteTable('holdings', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  ticker: text('ticker').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  amount: integer('amount').notNull(),
  purchasePrice: text('purchase_price').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const watchlist = sqliteTable('watchlist', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull(),
  displayName: text('display_name'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const notes = sqliteTable('notes', {
  ticker: text('ticker').primaryKey(),
  body: text('body').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type AccountRow = typeof accounts.$inferSelect;
export type HoldingRow = typeof holdings.$inferSelect;
export type WatchlistRow = typeof watchlist.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
