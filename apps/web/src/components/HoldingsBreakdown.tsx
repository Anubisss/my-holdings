import type { ReactNode } from 'react';

import {
  formatMoney,
  formatRoundedMoney,
  formatSignedPercent,
  formatSignedRoundedMoney,
  signColorClass,
  signOf,
} from '../lib/format';
import type {
  AppConfig,
  Currency,
  PortfolioSummary as PortfolioSummaryData,
  SummaryCash,
  SummaryStock,
} from '../types';

import { dash, fxNote } from './placeholders';
import { ReturnFigure } from './ReturnFigure';
import { SecondaryMoney } from './SecondaryMoney';

// Desktop column template, shared by the header and every row (stocks, cash,
// total) so they all line up on the same five columns from `sm` upwards.
const COLS_SM =
  'sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-3';

// Stock / total / header rows: on mobile we pack the cells into a compact
// two-column grid (the row's first child — the holding/label — spans the full
// width); on desktop everything lines up on the shared columns.
const GRID = `grid grid-cols-2 gap-x-4 gap-y-2 [&>*:first-child]:col-span-2 ${COLS_SM} sm:[&>*:first-child]:col-span-1`;

// Cash rows only carry a market value, so on mobile they collapse to a simple
// row with the currency on the left and the value on the right; the empty
// columns stay hidden until the shared grid kicks in at `sm`.
const CASH_GRID = `flex items-center justify-between gap-3 ${COLS_SM}`;

type CellProps = { label: string; children: ReactNode; className?: string };

const cashName = (cash: SummaryCash): string => `${cash.code} (${cash.symbol})`;

// Mobile: compact stat cell with the label stacked above the value. Desktop:
// label hidden, value right-aligned.
const Cell = ({ label, children, className = '' }: CellProps) => (
  <div className={`min-w-0 sm:text-right ${className}`}>
    <span className="block text-xs font-medium uppercase tracking-wide text-slate-400 sm:hidden dark:text-slate-500">
      {label}
    </span>
    <div>{children}</div>
  </div>
);

type StockRowProps = {
  stock: SummaryStock;
  currency: Currency;
  locale: string;
  secondaryCurrency: Currency | null;
};

const StockRow = ({ stock, currency, locale, secondaryCurrency }: StockRowProps) => {
  const amount = new Intl.NumberFormat(locale).format(stock.amount);
  const costBasis = formatRoundedMoney(stock.costBasis, currency);
  const averageCost = formatMoney(stock.averageCost, currency);
  const marketValue = formatRoundedMoney(stock.marketValue, currency);
  const returnValue = formatSignedRoundedMoney(stock.returnValue, currency);
  const dayChange = formatSignedRoundedMoney(stock.dayChange, currency);

  return (
    <li
      className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 ${GRID}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-900 dark:bg-slate-700 dark:text-slate-100">
          {stock.ticker}
        </span>
        {stock.valid ? null : (
          <span
            className="text-xs font-bold text-red-600 dark:text-red-400"
            title="No price data found for this ticker"
          >
            Invalid ticker
          </span>
        )}
      </div>

      <Cell label="Cost basis">
        <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {costBasis ?? dash}
        </span>
        {averageCost ? (
          <div className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {amount} × {averageCost}
          </div>
        ) : null}
        <SecondaryMoney value={stock.costBasisSecondary} currency={secondaryCurrency} />
      </Cell>

      <Cell label="Market value">
        <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
          {marketValue ?? dash}
        </span>
        <SecondaryMoney value={stock.marketValueSecondary} currency={secondaryCurrency} />
      </Cell>

      <Cell label="Daily return">
        <ReturnFigure
          rawValue={stock.dayChange}
          display={dayChange}
          percent={stock.dayChangePercent}
        />
        <SecondaryMoney value={stock.dayChangeSecondary} currency={secondaryCurrency} signed />
      </Cell>

      <Cell label="Total return">
        <ReturnFigure
          rawValue={stock.returnValue}
          display={returnValue}
          percent={stock.returnPercent}
        />
        <SecondaryMoney value={stock.returnValueSecondary} currency={secondaryCurrency} signed />
      </Cell>
    </li>
  );
};

type CashRowProps = {
  name: string;
  /** Main value in this bucket's own currency ("as it is"), already formatted. */
  value: string | null;
  /** Raw, unformatted value converted into the other currency. */
  convertedValue: string | null;
  /** The currency the value is converted into, or null when none is configured. */
  convertedCurrency: Currency | null;
  /** Whether to render the converted sub-line (secondary currency enabled). */
  showConverted: boolean;
};

// Cash carries no cost basis or return, so it only contributes a market value;
// the cost basis and return columns collapse to a dash. When a secondary
// currency is enabled it also shows the same cash converted into the other
// currency on a muted, abbreviated sub-line (full value on hover).
const CashRow = ({
  name,
  value,
  convertedValue,
  convertedCurrency,
  showConverted,
}: CashRowProps) => (
  <li
    className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 ${CASH_GRID}`}
  >
    <div className="min-w-0">
      <span className="font-semibold text-slate-900 dark:text-slate-100">{name}</span>
    </div>

    <Cell label="Cost basis" className="hidden sm:block">
      {dash}
    </Cell>

    <div className="min-w-0 text-right">
      <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
        {value ?? dash}
      </span>
      {showConverted ? (
        convertedValue === null ? (
          fxNote
        ) : (
          <SecondaryMoney value={convertedValue} currency={convertedCurrency} />
        )
      ) : null}
    </div>

    <Cell label="Daily return" className="hidden sm:block">
      {dash}
    </Cell>

    <Cell label="Total return" className="hidden sm:block">
      {dash}
    </Cell>
  </li>
);

type HoldingsBreakdownProps = {
  summary: PortfolioSummaryData;
  config: AppConfig;
};

// Per-stock breakdown of every holding, the aggregate "Holdings total" row, and
// the portfolio's cash buckets.
export const HoldingsBreakdown = ({ summary, config }: HoldingsBreakdownProps) => {
  const { primaryCurrency, secondaryCurrency } = config;
  const { stocks, primaryCash, secondaryCash, totals } = summary;
  const { holdings } = totals;

  // Primary figures are rounded to whole units; secondary figures are
  // abbreviated by `SecondaryMoney` at render time, so only the raw values are
  // needed for them here.
  const holdingsCostBasis = formatRoundedMoney(holdings.costBasis, primaryCurrency);
  const holdingsMarketValue = formatRoundedMoney(holdings.marketValue, primaryCurrency);
  const holdingsReturn = formatSignedRoundedMoney(holdings.returnValue, primaryCurrency);
  const holdingsDayChange = formatSignedRoundedMoney(holdings.dayChange, primaryCurrency);

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Holdings
      </h2>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <ul className="flex flex-col gap-2">
          <li
            className={`hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 ${GRID}`}
          >
            <span>Holding</span>
            <span className="text-right">Cost basis</span>
            <span className="text-right">Market value</span>
            <span className="text-right">Daily return</span>
            <span className="text-right">Total return</span>
          </li>

          {stocks.map((stock) => (
            <StockRow
              key={stock.ticker}
              stock={stock}
              currency={primaryCurrency}
              locale={primaryCurrency.locale}
              secondaryCurrency={secondaryCurrency}
            />
          ))}

          <li
            className={`mt-1 mb-3 rounded-lg border-l-4 border-slate-400 bg-slate-100 px-3 py-3 ring-1 ring-slate-400 transition-colors hover:bg-slate-200 dark:border-slate-500 dark:bg-slate-800/80 dark:ring-slate-600 dark:hover:bg-slate-700/80 ${GRID}`}
          >
            <span className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Total
            </span>

            <Cell label="Cost basis">
              <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {holdingsCostBasis ?? dash}
              </span>
              <SecondaryMoney value={holdings.costBasisSecondary} currency={secondaryCurrency} />
            </Cell>

            <Cell label="Market value">
              <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {holdingsMarketValue ?? dash}
              </span>
              <SecondaryMoney value={holdings.marketValueSecondary} currency={secondaryCurrency} />
            </Cell>

            <Cell label="Daily return">
              {holdingsDayChange !== null ? (
                <span
                  className={`font-bold tabular-nums ${signColorClass(signOf(holdings.dayChange))}`}
                >
                  {holdingsDayChange} ({formatSignedPercent(holdings.dayChangePercent)})
                </span>
              ) : (
                dash
              )}
              <SecondaryMoney
                value={holdings.dayChangeSecondary}
                currency={secondaryCurrency}
                signed
              />
            </Cell>

            <Cell label="Total return">
              {holdingsReturn !== null ? (
                <span
                  className={`font-bold tabular-nums ${signColorClass(signOf(holdings.returnValue))}`}
                >
                  {holdingsReturn} ({formatSignedPercent(holdings.returnPercent)})
                </span>
              ) : (
                dash
              )}
              <SecondaryMoney
                value={holdings.returnValueSecondary}
                currency={secondaryCurrency}
                signed
              />
            </Cell>
          </li>

          <li className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Cash
          </li>

          <CashRow
            name={cashName(primaryCash)}
            value={formatRoundedMoney(primaryCash.value, primaryCurrency)}
            convertedValue={primaryCash.valueSecondary}
            convertedCurrency={secondaryCurrency}
            showConverted={Boolean(secondaryCurrency)}
          />
          {secondaryCash ? (
            <CashRow
              name={cashName(secondaryCash)}
              value={formatRoundedMoney(secondaryCash.value, secondaryCash)}
              convertedValue={secondaryCash.valuePrimary}
              convertedCurrency={primaryCurrency}
              showConverted
            />
          ) : null}
        </ul>
      </div>
    </section>
  );
};
