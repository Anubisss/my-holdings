import type { ReactNode } from 'react';

import {
  formatMoney,
  formatRoundedMoney,
  formatSignedPercent,
  formatSignedRoundedMoney,
  signColorClass,
} from '../lib/format';
import type { AppConfig, PortfolioSummary as PortfolioSummaryData } from '../types';
import { SecondaryMoney } from './SecondaryMoney';
import { ReturnFigure } from './ReturnFigure';
import { dash, fxNote } from './placeholders';

type PortfolioSummaryProps = {
  summary: PortfolioSummaryData;
  config: AppConfig;
};

type StatBoxProps = { label: string; children: ReactNode };

// Compact figure tile used in the portfolio-value hero: a small label with a
// value (and optional secondary sub-line) beneath it.
const StatBox = ({ label, children }: StatBoxProps) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800">
    <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {label}
    </div>
    <div className="mt-0.5">{children}</div>
  </div>
);

// Top-of-page hero: the headline portfolio value plus the daily, total, and FX
// returns surfaced as compact stat tiles.
export const PortfolioSummary = ({ summary, config }: PortfolioSummaryProps) => {
  const { primaryCurrency, secondaryCurrency } = config;
  const { totals } = summary;
  const { holdings } = totals;

  const holdingsReturn = formatSignedRoundedMoney(holdings.returnValue, primaryCurrency);
  const holdingsDayChange = formatSignedRoundedMoney(holdings.dayChange, primaryCurrency);

  // The primary portfolio value keeps its full form; the secondary is rounded
  // to whole units.
  const portfolioValue = formatMoney(totals.portfolioValue, primaryCurrency);
  const portfolioValueSecondary = secondaryCurrency
    ? formatRoundedMoney(totals.portfolioValueSecondary, secondaryCurrency)
    : null;

  // Gain/loss in the secondary currency from today's FX move (backend-computed).
  const currencyChangeFigure = totals.currencyChange;
  const currencyChange =
    secondaryCurrency && currencyChangeFigure
      ? formatSignedRoundedMoney(currencyChangeFigure.value, secondaryCurrency)
      : null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Portfolio Summary
      </h2>

      <div className="flex flex-col gap-4 rounded-2xl border-l-4 border-indigo-500 bg-white p-4 shadow-md ring-1 ring-slate-200 lg:flex-row lg:items-center lg:justify-between dark:bg-slate-900 dark:ring-slate-800">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Portfolio value
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-slate-900 sm:text-4xl dark:text-slate-100">
            {portfolioValue ?? dash}
          </div>
          {portfolioValueSecondary !== null ? (
            <div className="text-lg font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {portfolioValueSecondary}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:auto-cols-fr sm:grid-flow-col">
          {secondaryCurrency ? (
            <StatBox label="Daily FX return">
              {currencyChange !== null && currencyChangeFigure ? (
                <span
                  className={`font-semibold tabular-nums ${signColorClass(currencyChangeFigure.percent)}`}
                >
                  <p>{currencyChange}</p>
                  <p>({formatSignedPercent(currencyChangeFigure.percent)})</p>
                </span>
              ) : (
                fxNote
              )}
            </StatBox>
          ) : null}

          <StatBox label="Daily return">
            <ReturnFigure
              rawValue={holdings.dayChange}
              display={holdingsDayChange}
              percent={holdings.dayChangePercent}
            />
            <SecondaryMoney
              value={holdings.dayChangeSecondary}
              currency={secondaryCurrency}
              signed
            />
          </StatBox>

          <StatBox label="Total return">
            <ReturnFigure
              rawValue={holdings.returnValue}
              display={holdingsReturn}
              percent={holdings.returnPercent}
            />
            <SecondaryMoney
              value={holdings.returnValueSecondary}
              currency={secondaryCurrency}
              signed
            />
          </StatBox>
        </div>
      </div>
    </section>
  );
};
