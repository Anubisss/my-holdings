import Big from 'big.js';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatMoney, formatRoundedMoney, getCurrencyAffix } from '../lib/format';
import { resolveIsDark, readStoredTheme } from '../lib/theme';
import type { AppConfig, Currency, PortfolioValueHistoryEntry } from '../types';

type TimelinePreset = '5D' | '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX' | 'YTD' | 'Custom';

type ChartDataPoint = {
  date: string;
  timestamp: number;
  valuePrimary: number | null;
  valueSecondary: number | null;
  currencyRate: number | null;
  pctPrimary: number | null;
  pctSecondary: number | null;
};

type ChartStats = {
  firstDate: string;
  lastDate: string;
  firstValue: number;
  lastValue: number;
  absoluteChange: number;
  percentChange: number;
  high: { value: number; date: string };
  low: { value: number; date: string };
};

type Props = {
  config: AppConfig;
  data: PortfolioValueHistoryEntry[];
  valuesHidden?: boolean;
};

const TIMELINE_PRESETS: TimelinePreset[] = [
  '5D',
  '1M',
  '6M',
  '1Y',
  '5Y',
  '10Y',
  'MAX',
  'YTD',
  'Custom',
];

const HIDDEN_VALUE = '••••';

const COLORS = {
  primary: { light: '#6366f1', dark: '#818cf8' },
  secondary: { light: '#10b981', dark: '#34d399' },
  rate: { light: '#f59e0b', dark: '#fbbf24' },
  grid: { light: '#e7e9ed', dark: '#34383f' },
  axis: { light: '#6b7079', dark: '#9aa0a9' },
  tooltipBg: { light: '#ffffff', dark: '#212329' },
  tooltipBorder: { light: '#e7e9ed', dark: '#34383f' },
  tooltipText: { light: '#131318', dark: '#f5f6f8' },
};

const isWeekday = (dateStr: string): boolean => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
};

const toNum = (v: string | null): number | null => {
  if (v === null || v === '') return null;
  try {
    return new Big(v).toNumber();
  } catch {
    return null;
  }
};

const formatDateLong = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const subtractMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
};

const subtractYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result;
};

const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

const formatTickMoney = (v: number, currency: Currency): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  let num: string;
  if (abs >= 1_000_000) {
    num = `${Math.round((abs / 1_000_000) * 10) / 10}M`;
  } else if (abs >= 1_000) {
    num = `${Math.round(abs / 1_000)}k`;
  } else {
    num = `${Math.round(abs)}`;
  }
  const { symbol, position } = getCurrencyAffix(currency);
  return position === 'prefix' ? `${sign}${symbol}${num}` : `${sign}${num} ${symbol}`;
};

const getStartDateForPreset = (preset: TimelinePreset, today: Date): string | null => {
  switch (preset) {
    case '5D': {
      let weekdaysBack = 0;
      const d = new Date(today);
      while (weekdaysBack < 5) {
        d.setUTCDate(d.getUTCDate() - 1);
        const day = d.getUTCDay();
        if (day !== 0 && day !== 6) weekdaysBack++;
      }
      return toISODate(d);
    }
    case '1M':
      return toISODate(subtractMonths(today, 1));
    case '6M':
      return toISODate(subtractMonths(today, 6));
    case '1Y':
      return toISODate(subtractYears(today, 1));
    case '5Y':
      return toISODate(subtractYears(today, 5));
    case '10Y':
      return toISODate(subtractYears(today, 10));
    case 'YTD':
      return `${today.getUTCFullYear()}-01-01`;
    case 'MAX':
    case 'Custom':
      return null;
  }
};

const computeStats = (
  points: ChartDataPoint[],
  key: 'valuePrimary' | 'valueSecondary' | 'currencyRate',
): ChartStats | null => {
  const valid = points.filter((p) => p[key] !== null) as (ChartDataPoint & {
    [K in typeof key]: number;
  })[];
  if (valid.length < 2) return null;

  const first = valid[0];
  const last = valid[valid.length - 1];
  const firstVal = first[key];
  const lastVal = last[key];

  let high = { value: firstVal, date: first.date };
  let low = { value: firstVal, date: first.date };

  for (const p of valid) {
    const v = p[key];
    if (v > high.value) high = { value: v, date: p.date };
    if (v < low.value) low = { value: v, date: p.date };
  }

  return {
    firstDate: first.date,
    lastDate: last.date,
    firstValue: firstVal,
    lastValue: lastVal,
    absoluteChange: lastVal - firstVal,
    percentChange: firstVal !== 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0,
    high,
    low,
  };
};

const MOBILE_QUERY = '(max-width: 640px), (max-height: 500px)';

const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => setIsMobile(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
};

const useWindowHeight = (): number => {
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const handleResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return height;
};

const useIsDark = (): boolean => {
  const [isDark, setIsDark] = useState(() => resolveIsDark(readStoredTheme()));

  useEffect(() => {
    const check = () => setIsDark(resolveIsDark(readStoredTheme()));
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

const TimelineSelector = ({
  active,
  onSelect,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  minDate,
  maxDate,
}: {
  active: TimelinePreset;
  onSelect: (preset: TimelinePreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  minDate: string;
  maxDate: string;
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Timeline range">
      {TIMELINE_PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onSelect(preset)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            active === preset
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
          }`}
          aria-pressed={active === preset}
          tabIndex={0}
          aria-label={`Select ${preset} timeline`}
        >
          {preset}
        </button>
      ))}
    </div>
    {active === 'Custom' ? (
      <div className="flex flex-row items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          From
          <input
            type="date"
            value={customStart}
            min={minDate}
            max={customEnd || maxDate}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          To
          <input
            type="date"
            value={customEnd}
            min={customStart || minDate}
            max={maxDate}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </div>
    ) : null}
  </div>
);

const StatsPanel = ({
  stats,
  currency,
  label,
  roundLargeValues = false,
  hidden = false,
}: {
  stats: ChartStats;
  currency: Currency | null;
  label: string;
  roundLargeValues?: boolean;
  hidden?: boolean;
}) => {
  const isMobile = useIsMobile();
  const fmt = (v: number) => {
    if (hidden) return HIDDEN_VALUE;
    if (roundLargeValues && Math.abs(v) >= 1_000 && currency) {
      return formatRoundedMoney(v.toFixed(0), currency) ?? v.toFixed(0);
    }
    const str = v.toFixed(2);
    return currency ? (formatMoney(str, currency) ?? str) : str;
  };
  const changeColor =
    stats.percentChange > 0
      ? 'text-green-600 dark:text-green-400'
      : stats.percentChange < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-500 dark:text-slate-400';
  const sign = stats.percentChange > 0 ? '+' : '';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-slate-500 dark:text-slate-400">Period</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatDateLong(stats.firstDate)} — {formatDateLong(stats.lastDate)}
          </span>
        </div>
        {isMobile ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 dark:text-slate-400">Open</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {fmt(stats.firstValue)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 dark:text-slate-400">Close</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {fmt(stats.lastValue)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 dark:text-slate-400">Change</span>
              <span className={`font-medium ${changeColor}`}>
                {hidden ? '' : `${sign}${fmt(stats.absoluteChange)} `}({sign}
                {stats.percentChange.toFixed(2)}%)
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 dark:text-slate-400">Open / Close</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {fmt(stats.firstValue)} → {fmt(stats.lastValue)}
            </span>
            <span className={`font-medium ${changeColor}`}>
              {hidden ? '' : `${sign}${fmt(stats.absoluteChange)} `}({sign}
              {stats.percentChange.toFixed(2)}%)
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-slate-500 dark:text-slate-400">High / Low</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {fmt(stats.high.value)} / {fmt(stats.low.value)}
          </span>
        </div>
      </div>
    </div>
  );
};

type ChartCardProps = {
  title: string;
  data: ChartDataPoint[];
  dataKeys: {
    key: 'valuePrimary' | 'valueSecondary' | 'currencyRate' | 'pctPrimary' | 'pctSecondary';
    name: string;
    color: string;
  }[];
  formatXTick: (ts: number) => string;
  formatYTick: (v: number) => string;
  formatTooltipValue: (v: number, name: string) => string;
  isDark: boolean;
  isMobile: boolean;
  windowHeight: number;
  hidden?: boolean;
};

const ChartCard = ({
  title,
  data,
  dataKeys,
  formatXTick,
  formatYTick,
  formatTooltipValue,
  isDark,
  isMobile,
  windowHeight,
  hidden = false,
}: ChartCardProps) => {
  const theme = isDark ? 'dark' : 'light';

  // TODO: remove this debug log
  console.log(`[Chart "${title}"] data points / ticks: ${data.length}`);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h4>
      <ResponsiveContainer width="100%" height={isMobile ? Math.min(450, windowHeight - 80) : 500}>
        <LineChart data={data} margin={{ top: 16, right: 4, left: isMobile ? -18 : 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid[theme]} vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatXTick}
            tick={{ fontSize: 11, fill: COLORS.axis[theme] }}
            tickLine={false}
            axisLine={{ stroke: COLORS.grid[theme] }}
            minTickGap={40}
            tickMargin={14}
          />
          <YAxis
            tick={{ fontSize: isMobile ? 10 : 11, fill: COLORS.axis[theme] }}
            tickLine={false}
            axisLine={false}
            tickFormatter={hidden ? () => HIDDEN_VALUE : formatYTick}
            width={isMobile ? 70 : 60}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.tooltipBg[theme],
              border: `1px solid ${COLORS.tooltipBorder[theme]}`,
              borderRadius: 8,
              fontSize: 12,
              color: COLORS.tooltipText[theme],
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4, color: COLORS.tooltipText[theme] }}
            formatter={(value, name) => [
              hidden ? HIDDEN_VALUE : formatTooltipValue(value as number, name as string),
              name,
            ]}
            labelFormatter={(label) => {
              const d = new Date(label as number);
              return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              });
            }}
          />
          {dataKeys.length > 1 ? (
            <Legend wrapperStyle={{ fontSize: 12, color: COLORS.axis[theme] }} iconType="line" />
          ) : null}
          {dataKeys.map((dk) => (
            <Line
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              name={dk.name}
              stroke={dk.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PortfolioCharts = ({ config, data, valuesHidden = false }: Props) => {
  const isDark = useIsDark();
  const isMobile = useIsMobile();
  const windowHeight = useWindowHeight();
  const { primaryCurrency, secondaryCurrency } = config;

  const [timeline, setTimeline] = useState<TimelinePreset>('5D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const weekdayData = useMemo(() => data.filter((d) => isWeekday(d.date)), [data]);

  const minDate = weekdayData.length > 0 ? weekdayData[0].date : '';
  const maxDate = weekdayData.length > 0 ? weekdayData[weekdayData.length - 1].date : '';

  const handleTimelineSelect = (preset: TimelinePreset) => {
    setTimeline(preset);
    if (preset === 'Custom' && !customEnd && maxDate) {
      setCustomEnd(maxDate);
    }
  };

  const filteredData = useMemo(() => {
    if (weekdayData.length === 0) return [];

    const today = new Date();
    let startDate: string | null = null;
    let endDate: string = toISODate(today);

    if (timeline === 'Custom') {
      startDate = customStart || null;
      endDate = customEnd || toISODate(today);
    } else {
      startDate = getStartDateForPreset(timeline, today);
    }

    return weekdayData.filter((d) => {
      if (startDate && d.date < startDate) return false;
      if (d.date > endDate) return false;
      return true;
    });
  }, [weekdayData, timeline, customStart, customEnd]);

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (filteredData.length === 0) return [];

    const firstPrimary = toNum(filteredData[0].valuePrimary);
    const firstSecondary = toNum(filteredData[0].valueSecondary);

    return filteredData.map((entry) => {
      const vp = toNum(entry.valuePrimary);
      const vs = toNum(entry.valueSecondary);
      const cr = toNum(entry.currencyRate);
      return {
        date: entry.date,
        timestamp: new Date(`${entry.date}T00:00:00Z`).getTime(),
        valuePrimary: vp,
        valueSecondary: vs,
        currencyRate: cr,
        pctPrimary:
          vp !== null && firstPrimary !== null && firstPrimary !== 0
            ? ((vp - firstPrimary) / firstPrimary) * 100
            : null,
        pctSecondary:
          vs !== null && firstSecondary !== null && firstSecondary !== 0
            ? ((vs - firstSecondary) / firstSecondary) * 100
            : null,
      };
    });
  }, [filteredData]);

  const theme = isDark ? 'dark' : 'light';

  const spanDays =
    chartData.length >= 2
      ? (chartData[chartData.length - 1].timestamp - chartData[0].timestamp) / (1000 * 60 * 60 * 24)
      : 0;

  const formatXTick = (ts: number): string => {
    const d = new Date(ts);
    if (spanDays > 365 * 3) {
      return d.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });
    }
    if (spanDays > 365) {
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    }
    if (spanDays > 30) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const fmtMoney = (v: number, currency: Currency) => formatTickMoney(v, currency);

  const fmtMoneyFull = (v: number, currency: Currency) =>
    formatMoney(v.toFixed(2), currency) ?? v.toFixed(2);

  const primaryStats = useMemo(() => computeStats(chartData, 'valuePrimary'), [chartData]);
  const secondaryStats = useMemo(
    () => (secondaryCurrency ? computeStats(chartData, 'valueSecondary') : null),
    [chartData, secondaryCurrency],
  );
  const rateStats = useMemo(
    () => (secondaryCurrency ? computeStats(chartData, 'currencyRate') : null),
    [chartData, secondaryCurrency],
  );

  if (weekdayData.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No portfolio history data yet. Snapshots are saved automatically on weekdays, or you can
          import data below.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <TimelineSelector
        active={timeline}
        onSelect={handleTimelineSelect}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        minDate={minDate}
        maxDate={maxDate}
      />

      {chartData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No data available for the selected time range.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <ChartCard
              title={`Portfolio Value (${primaryCurrency.code})`}
              data={chartData}
              dataKeys={[
                {
                  key: 'valuePrimary',
                  name: primaryCurrency.code,
                  color: COLORS.primary[theme],
                },
              ]}
              formatXTick={formatXTick}
              formatYTick={(v) => fmtMoney(v, primaryCurrency)}
              formatTooltipValue={(v) => fmtMoneyFull(v, primaryCurrency)}
              isDark={isDark}
              isMobile={isMobile}
              windowHeight={windowHeight}
              hidden={valuesHidden}
            />
            {primaryStats ? (
              <div className="mt-2">
                <StatsPanel
                  stats={primaryStats}
                  currency={primaryCurrency}
                  label="Summary"
                  roundLargeValues
                  hidden={valuesHidden}
                />
              </div>
            ) : null}
          </div>

          {secondaryCurrency ? (
            <>
              <div>
                <ChartCard
                  title={`Portfolio Value (${secondaryCurrency.code})`}
                  data={chartData}
                  dataKeys={[
                    {
                      key: 'valueSecondary',
                      name: secondaryCurrency.code,
                      color: COLORS.secondary[theme],
                    },
                  ]}
                  formatXTick={formatXTick}
                  formatYTick={(v) => fmtMoney(v, secondaryCurrency)}
                  formatTooltipValue={(v) => fmtMoneyFull(v, secondaryCurrency)}
                  isDark={isDark}
                  isMobile={isMobile}
                  windowHeight={windowHeight}
                  hidden={valuesHidden}
                />
                {secondaryStats ? (
                  <div className="mt-2">
                    <StatsPanel
                      stats={secondaryStats}
                      currency={secondaryCurrency}
                      label="Summary"
                      roundLargeValues
                      hidden={valuesHidden}
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <ChartCard
                  title="Relative Performance (%)"
                  data={chartData}
                  dataKeys={[
                    {
                      key: 'pctPrimary',
                      name: primaryCurrency.code,
                      color: COLORS.primary[theme],
                    },
                    {
                      key: 'pctSecondary',
                      name: secondaryCurrency.code,
                      color: COLORS.secondary[theme],
                    },
                  ]}
                  formatXTick={formatXTick}
                  formatYTick={(v) => {
                    const sign = v >= 0 ? '+' : '';
                    const abs = Math.abs(v);
                    if (abs >= 1_000) {
                      const k = Math.round((abs / 1_000) * 10) / 10;
                      return `${sign}${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k%`;
                    }
                    return `${sign}${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}%`;
                  }}
                  formatTooltipValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}
                  isDark={isDark}
                  isMobile={isMobile}
                  windowHeight={windowHeight}
                />
              </div>

              <div>
                <ChartCard
                  title={`Exchange Rate (${primaryCurrency.code}/${secondaryCurrency.code})`}
                  data={chartData}
                  dataKeys={[
                    {
                      key: 'currencyRate',
                      name: `${primaryCurrency.code}/${secondaryCurrency.code}`,
                      color: COLORS.rate[theme],
                    },
                  ]}
                  formatXTick={formatXTick}
                  formatYTick={(v) => {
                    const num = Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
                    const { symbol, position } = getCurrencyAffix(secondaryCurrency);
                    return position === 'prefix' ? `${symbol}${num}` : `${num} ${symbol}`;
                  }}
                  formatTooltipValue={(v) =>
                    `1 ${primaryCurrency.code} = ${v.toFixed(2)} ${secondaryCurrency.code}`
                  }
                  isDark={isDark}
                  isMobile={isMobile}
                  windowHeight={windowHeight}
                />
                {rateStats ? (
                  <div className="mt-2">
                    <StatsPanel stats={rateStats} currency={null} label="Summary" />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
