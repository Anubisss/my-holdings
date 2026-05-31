import type { ReactNode } from 'react';

import { formatDateDisplay } from '../lib/date';
import {
  formatCompactMoney,
  formatMoney,
  formatRoundedMoney,
  formatSignedCompactMoney,
  formatSignedMoney,
  formatSignedRoundedMoney,
  formatSignedPercent,
  signColorClass,
  signOf,
} from '../lib/format';
import { holdingCostBasis } from '../lib/holdings';
import type { Currency, Holding } from '../types';
import { Button } from './ui';

type HoldingRowProps = {
  holding: Holding;
  currency: Currency;
  /** When set (secondary currency enabled), values are also shown converted to it. */
  secondaryCurrency?: Currency | null;
  onEdit: () => void;
  onDelete: () => void;
};

// Shared grid template so the header and every row line up as a single table
// row once there's enough width. Below the threshold we pack the cells into a
// compact two-column grid: the holding and the actions sit together on the top
// row (placed explicitly below), and the four data cells flow two-per-row
// beneath them. We switch to the table at 700px (rather than `md`/768px) so
// landscape phones — including iPhone Display Zoom widths — get the single-row
// layout instead of the wasteful two-column one. The actions column is a fixed
// width (not `auto`) so its content width can't shift the flexible columns out
// of sync between the header and the rows.
const GRID =
  'grid grid-cols-2 gap-x-4 gap-y-2 min-[660px]:grid min-[660px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_9rem] min-[660px]:items-center min-[660px]:gap-3';

// Individual positions intentionally don't surface pre/after-hours pricing or
// sessions (that lives on the price boards), so anything but regular trading
// collapses to "Market closed".
const marketStateLabel = (state: string | null): string =>
  state === 'REGULAR' ? 'Market open' : 'Market closed';

export const HoldingsHeader = () => (
  <li
    className={`hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 ${GRID}`}
  >
    <span>Holding</span>
    <span className="text-right">Cost basis</span>
    <span className="text-right">Price</span>
    <span className="text-right">Market value</span>
    <span className="text-right">Total return</span>
    <span className="sr-only">Actions</span>
  </li>
);

const dash = <span className="text-slate-400 dark:text-slate-500">—</span>;

// Muted sub-line showing a value converted into the secondary currency. The
// figure is abbreviated (e.g. "$1.13M"); hovering reveals the full value via a
// native tooltip. Hidden entirely when the conversion isn't available (e.g.
// missing FX rate).
const SecondaryLine = ({ value, title }: { value: string | null; title: string | null }) =>
  value === null ? null : (
    <div className="cursor-help text-xs text-slate-400 dark:text-slate-500" title={title ?? value}>
      {value}
    </div>
  );

type CellProps = { label: string; children: ReactNode };

// Mobile: compact stat cell with the label stacked above the value. Desktop:
// label hidden, value right-aligned.
const Cell = ({ label, children }: CellProps) => (
  <div className="min-w-0 min-[660px]:text-right">
    <span className="block text-xs font-medium uppercase tracking-wide text-slate-400 min-[660px]:hidden dark:text-slate-500">
      {label}
    </span>
    <div>{children}</div>
  </div>
);

export const HoldingRow = ({
  holding,
  currency,
  secondaryCurrency,
  onEdit,
  onDelete,
}: HoldingRowProps) => {
  const { quote } = holding;
  const isInvalid = !quote.valid;

  const price = formatMoney(quote.price, currency);
  const marketValue = formatRoundedMoney(quote.currentValue, currency);
  const costBasis = formatRoundedMoney(holdingCostBasis(holding), currency);
  const perShare = formatMoney(holding.purchasePrice, currency);
  const returnValue = formatSignedRoundedMoney(quote.returnValue, currency);
  const returnPercent = formatSignedPercent(quote.returnPercent);

  // Secondary-currency figures are pre-computed by the backend; the frontend
  // only formats them. They're null when the secondary currency is disabled or
  // the FX rate is unavailable, in which case the sub-lines render nothing. The
  // `*Full` variants are the unabbreviated values surfaced on hover.
  const costBasisSecondary = secondaryCurrency
    ? formatCompactMoney(holding.costBasisSecondary, secondaryCurrency)
    : null;
  const costBasisSecondaryFull = secondaryCurrency
    ? formatRoundedMoney(holding.costBasisSecondary, secondaryCurrency)
    : null;
  const marketValueSecondary = secondaryCurrency
    ? formatCompactMoney(quote.currentValueSecondary, secondaryCurrency)
    : null;
  const marketValueSecondaryFull = secondaryCurrency
    ? formatRoundedMoney(quote.currentValueSecondary, secondaryCurrency)
    : null;
  const returnValueSecondary = secondaryCurrency
    ? formatSignedCompactMoney(quote.returnValueSecondary, secondaryCurrency)
    : null;
  const returnValueSecondaryFull = secondaryCurrency
    ? formatSignedRoundedMoney(quote.returnValueSecondary, secondaryCurrency)
    : null;

  // `dayChange` is the regular-session change vs the prior close, provided in
  // every market state, so the day's change still shows pre-market, after-hours,
  // and once closed while we keep the closed label.
  const showDayChange = quote.dayChange !== null;

  return (
    <li
      className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 min-[660px]:py-1 ${GRID}`}
    >
      <div className="col-start-1 row-start-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 min-[660px]:col-auto min-[660px]:row-auto min-[660px]:block">
        <div className="flex flex-wrap items-center gap-2 min-[660px]:mb-1">
          <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-900 dark:bg-slate-700 dark:text-slate-100">
            {holding.ticker}
          </span>
          {isInvalid ? (
            <span
              className="font-bold text-red-600 dark:text-red-400"
              title="No price data found for this ticker"
            >
              Invalid ticker
            </span>
          ) : null}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {formatDateDisplay(holding.purchaseDate)}
        </div>
      </div>

      <Cell label="Cost basis">
        {costBasis ? (
          <>
            <div className="font-medium text-slate-700 dark:text-slate-200">{costBasis}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {holding.amount} × {perShare}
            </div>
            <SecondaryLine value={costBasisSecondary} title={costBasisSecondaryFull} />
          </>
        ) : (
          dash
        )}
      </Cell>

      <Cell label="Price">
        {price ? (
          <>
            <div className="font-medium text-slate-900 dark:text-slate-100">{price}</div>
            {showDayChange ? (
              <div className={`text-xs font-medium ${signColorClass(quote.dayChangePercent)}`}>
                {formatSignedMoney(quote.dayChange, currency)} (
                {formatSignedPercent(quote.dayChangePercent)})
              </div>
            ) : null}
            {!quote.isMarketOpen ? (
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {marketStateLabel(quote.marketState)}
              </div>
            ) : null}
          </>
        ) : (
          dash
        )}
      </Cell>

      <Cell label="Market value">
        {marketValue ? (
          <>
            <span className="font-medium text-slate-900 dark:text-slate-100">{marketValue}</span>
            <SecondaryLine value={marketValueSecondary} title={marketValueSecondaryFull} />
          </>
        ) : (
          dash
        )}
      </Cell>

      <Cell label="Total return">
        {returnValue ? (
          <>
            <div className={`font-semibold ${signColorClass(signOf(quote.returnValue))}`}>
              {returnValue}
            </div>
            <div className={`text-xs ${signColorClass(quote.returnPercent)}`}>{returnPercent}</div>
            <SecondaryLine value={returnValueSecondary} title={returnValueSecondaryFull} />
          </>
        ) : (
          dash
        )}
      </Cell>

      <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 min-[660px]:col-auto min-[660px]:row-auto min-[660px]:justify-normal">
        <Button
          variant="ghost"
          className="hover:!bg-slate-200 dark:hover:!bg-slate-700"
          aria-label={`Edit ${holding.ticker}`}
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          className="hover:!bg-slate-200 dark:hover:!bg-slate-700"
          aria-label={`Delete ${holding.ticker}`}
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </li>
  );
};
