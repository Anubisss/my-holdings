export type Currency = {
  code: string;
  symbol: string;
  locale: string;
};

export type AppConfig = {
  primaryCurrency: Currency;
  secondaryCurrency: Currency | null;
};

export type PriceQuote = {
  valid: boolean;
  marketState: string | null;
  isMarketOpen: boolean;
  price: string | null;
  currency: string | null;
  dayChange: string | null;
  dayChangePercent: number | null;
  extendedPrice: string | null;
  extendedChange: string | null;
  extendedChangePercent: number | null;
};

export type HoldingQuote = PriceQuote & {
  currentValue: string | null;
  currentValueSecondary: string | null;
  returnValue: string | null;
  returnValueSecondary: string | null;
  returnPercent: number | null;
};

export type Holding = {
  id: string;
  accountId: string;
  ticker: string;
  purchaseDate: string;
  amount: number;
  purchasePrice: string;
  costBasisSecondary: string | null;
  createdAt: string;
  updatedAt: string;
  quote: HoldingQuote;
};

export type Account = {
  id: string;
  name: string;
  cashPrimary: string | null;
  cashPrimarySecondary: string | null;
  cashSecondary: string | null;
  cashSecondaryPrimary: string | null;
  createdAt: string;
  updatedAt: string;
  holdings: Holding[];
};

export type HoldingInput = {
  ticker: string;
  purchaseDate: string;
  amount: number;
  purchasePrice: string;
};

export type CashInput = {
  primary?: string | null;
  secondary?: string | null;
};

export type WatchlistItem = {
  id: string;
  ticker: string;
  displayName: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  quote: PriceQuote;
};

export type WatchlistInput = {
  ticker: string;
  displayName: string | null;
  pinned: boolean;
};

export type SummaryStock = {
  ticker: string;
  amount: number;
  costBasis: string;
  costBasisSecondary: string | null;
  averageCost: string | null;
  price: string | null;
  marketValue: string | null;
  marketValueSecondary: string | null;
  returnValue: string | null;
  returnValueSecondary: string | null;
  returnPercent: number | null;
  dayChange: string | null;
  dayChangeSecondary: string | null;
  dayChangePercent: number | null;
  valid: boolean;
};

export type SummaryCash = {
  code: string;
  symbol: string;
  locale: string;
  value: string;
  valueSecondary: string | null;
};

export type SummarySecondaryCash = SummaryCash & {
  valuePrimary: string | null;
  rate: string | null;
  ratePercent: number | null;
  rateTicker: string | null;
};

export type CurrencyChange = {
  value: string;
  percent: number;
};

export type PortfolioSummary = {
  stocks: SummaryStock[];
  primaryCash: SummaryCash;
  secondaryCash: SummarySecondaryCash | null;
  totals: {
    holdings: {
      costBasis: string;
      costBasisSecondary: string | null;
      marketValue: string;
      marketValueSecondary: string | null;
      returnValue: string;
      returnValueSecondary: string | null;
      returnPercent: number;
      dayChange: string;
      dayChangeSecondary: string | null;
      dayChangePercent: number;
    };
    portfolioValue: string;
    portfolioValueSecondary: string | null;
    currencyChange: CurrencyChange | null;
  };
};
