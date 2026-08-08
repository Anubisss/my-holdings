import { type ReactNode, useState } from 'react';

import { useNotes } from '../api/hooks';
import {
  formatMoney,
  formatQuoteMoney,
  formatSignedMoney,
  formatSignedPercent,
  formatSignedQuoteMoney,
  signColorClass,
} from '../lib/format';
import type { AppConfig, Notes, PriceQuote } from '../types';
import { NoteEditor } from './NoteEditor';

export type PriceBoardItem = {
  ticker: string;
  displayName?: string | null;
  pinned?: boolean;
  quote: PriceQuote;
};

type PriceBoardProps = {
  title: string;
  items: PriceBoardItem[];
  config: AppConfig;
  /**
   * When true, prices render in the quote's own currency (secondary symbol when
   * it matches, otherwise the raw currency code). When false (the default),
   * everything renders in the primary currency.
   */
  useQuoteCurrency?: boolean;
  /** Optional control rendered on the right of the section header (e.g. an Edit button). */
  action?: ReactNode;
  /** Shown instead of the grid when there are no items. */
  emptyLabel?: string;
};

const extendedSessionLabel = (state: string | null): string =>
  state === 'PRE' || state === 'PREPRE' ? 'Pre-market' : 'After hours';

type PriceTileProps = PriceBoardItem & {
  config: AppConfig;
  useQuoteCurrency: boolean;
  hasNote: boolean;
  onOpenNote: (ticker: string) => void;
};

const PriceTile = ({
  ticker,
  displayName,
  pinned,
  quote,
  config,
  useQuoteCurrency,
  hasNote,
  onOpenNote,
}: PriceTileProps) => {
  const money = (value: string | null): string | null =>
    useQuoteCurrency
      ? formatQuoteMoney(value, quote.currency, config)
      : formatMoney(value, config.primaryCurrency);
  const signedMoney = (value: string | null): string | null =>
    useQuoteCurrency
      ? formatSignedQuoteMoney(value, quote.currency, config)
      : formatSignedMoney(value, config.primaryCurrency);

  const name = displayName ?? ticker;
  const price = money(quote.price);
  // `dayChange` is the regular-session change vs the prior close. It's supplied
  // in every market state (open, pre-market, after-hours, closed), so the day's
  // change stays visible alongside any extended pricing.
  const showDayChange = quote.dayChange !== null;
  const showExtended = !quote.isMarketOpen && quote.extendedPrice !== null;
  // Closed (no live trading and no pre/post session, e.g. indices): still flag
  // it as closed, even when today's regular change is shown above.
  const isMarketClosed = !quote.isMarketOpen && quote.extendedPrice === null;
  const extendedPrice = money(quote.extendedPrice);

  return (
    <button
      type="button"
      onClick={() => onOpenNote(ticker)}
      aria-label={`${hasNote ? 'Edit' : 'Add'} note for ${name}`}
      className="w-full rounded-xl bg-white p-2 text-left shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800"
    >
      <div className="flex items-center gap-1">
        {pinned ? (
          <span aria-label="Pinned" title="Pinned" className="text-amber-500 dark:text-amber-400">
            ★
          </span>
        ) : null}
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {name}
        </span>
        <span
          aria-hidden="true"
          className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${hasNote ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      </div>
      {displayName && displayName !== ticker ? (
        <div className="truncate text-xs text-slate-400 dark:text-slate-500">{ticker}</div>
      ) : null}
      {quote.valid && price ? (
        <>
          <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {price}
          </div>
          {showDayChange ? (
            <div
              className={`text-xs font-medium tabular-nums ${signColorClass(quote.dayChangePercent)}`}
            >
              {signedMoney(quote.dayChange)} ({formatSignedPercent(quote.dayChangePercent)})
            </div>
          ) : null}
          {showExtended ? (
            <div className="mt-2">
              <div className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {extendedSessionLabel(quote.marketState)}
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {extendedPrice}
              </div>
              <div
                className={`text-xs font-medium tabular-nums ${signColorClass(quote.extendedChangePercent)}`}
              >
                {signedMoney(quote.extendedChange)} (
                {formatSignedPercent(quote.extendedChangePercent)})
              </div>
            </div>
          ) : null}
          {isMarketClosed ? (
            <div className="text-xs text-slate-400 dark:text-slate-500">Market closed</div>
          ) : null}
        </>
      ) : (
        <div className="mt-1 text-sm font-bold text-red-600 dark:text-red-400">Invalid ticker</div>
      )}
    </button>
  );
};

type TileGridProps = {
  items: PriceBoardItem[];
  config: AppConfig;
  useQuoteCurrency: boolean;
  notes: Notes;
  onOpenNote: (ticker: string) => void;
};

const TileGrid = ({ items, config, useQuoteCurrency, notes, onOpenNote }: TileGridProps) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
    {items.map((item) => (
      <PriceTile
        key={item.ticker}
        {...item}
        config={config}
        useQuoteCurrency={useQuoteCurrency}
        hasNote={Boolean(notes[item.ticker])}
        onOpenNote={onOpenNote}
      />
    ))}
  </div>
);

export const PriceBoard = ({
  title,
  items,
  config,
  useQuoteCurrency = false,
  action,
  emptyLabel,
}: PriceBoardProps) => {
  const notes = useNotes().data ?? {};
  const [noteTicker, setNoteTicker] = useState<string | null>(null);

  const pinned = items.filter((item) => item.pinned);
  const rest = items.filter((item) => !item.pinned);
  // When both groups exist, render them as separate grids divided by a rule so
  // the unpinned items always begin on a fresh row, never tucked beside pinned ones.
  const isGrouped = pinned.length > 0 && rest.length > 0;

  const noteItem = items.find((item) => item.ticker === noteTicker);
  const gridProps = { config, useQuoteCurrency, notes, onOpenNote: setNoteTicker };

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h2>
        {action}
      </div>
      {items.length > 0 ? (
        isGrouped ? (
          <div className="flex flex-col gap-3">
            <TileGrid items={pinned} {...gridProps} />
            <hr className="border-slate-200 dark:border-slate-800" />
            <TileGrid items={rest} {...gridProps} />
          </div>
        ) : (
          <TileGrid items={items} {...gridProps} />
        )
      ) : emptyLabel ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">{emptyLabel}</p>
      ) : null}
      {noteItem ? (
        <NoteEditor
          ticker={noteItem.ticker}
          name={noteItem.displayName ?? noteItem.ticker}
          initialBody={notes[noteItem.ticker] ?? ''}
          onClose={() => setNoteTicker(null)}
        />
      ) : null}
    </section>
  );
};
