import { useState } from 'react';

import { useAccounts, useConfig, useCreateAccount, useSummary, useWatchlist } from './api/hooks';
import { AccountCard } from './components/AccountCard';
import { AccountForm } from './components/AccountForm';
import { PortfolioSummary } from './components/PortfolioSummary';
import { PriceBoard } from './components/PriceBoard';
import { ThemeToggle } from './components/ThemeToggle';
import { Button, Spinner } from './components/ui';
import { WatchlistEditor } from './components/WatchlistEditor';
import { uniqueHoldings } from './lib/holdings';
import { HoldingsBreakdown } from './components/HoldingsBreakdown';

const AppHeader = () => (
  <header className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
      MyHoldings
    </h1>
    <ThemeToggle />
  </header>
);

const AppFooter = () => (
  <footer className="mt-auto pt-8 text-center text-xs text-slate-500 dark:text-slate-400">
    <p className="mb-1 text-xs text-slate-500 dark:text-slate-600">MyHoldings</p>
    <a
      href="https://github.com/Anubisss/my-holdings"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:hover:text-slate-100"
    >
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="currentColor"
        aria-hidden="true"
        className="h-6 w-6"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  </footer>
);

export const App = () => {
  const config = useConfig();
  const accounts = useAccounts();
  const watchlist = useWatchlist();
  const summary = useSummary();
  const createAccount = useCreateAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingWatchlist, setIsEditingWatchlist] = useState(false);

  const isInitialLoading = config.isLoading || accounts.isLoading;
  const loadError = config.error ?? accounts.error;

  // Gate the whole app: nothing is usable until config and accounts have loaded.
  if (isInitialLoading || loadError || !config.data || !accounts.data) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-6">
        <AppHeader />
        <div className="flex flex-1 items-center justify-center">
          {loadError ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              Failed to load: {loadError.message}
            </p>
          ) : (
            <Spinner label="Loading your portfolio..." />
          )}
        </div>
      </div>
    );
  }

  const { data: configData } = config;
  const { data: accountsData } = accounts;
  const holdings = uniqueHoldings(accountsData);
  const watchlistItems = watchlist.data ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-16 pt-6">
      <AppHeader />

      {summary.data ? <PortfolioSummary summary={summary.data} config={configData} /> : null}

      <PriceBoard
        title="Watchlist"
        items={watchlistItems}
        config={configData}
        useQuoteCurrency
        emptyLabel="No watchlist items yet. Use Edit to add tickers to watch."
        action={
          <Button variant="secondary" onClick={() => setIsEditingWatchlist(true)}>
            Edit
          </Button>
        }
      />

      {holdings.length > 0 ? (
        <PriceBoard title="Holding Prices" items={holdings} config={configData} />
      ) : null}

      {summary.data ? <HoldingsBreakdown summary={summary.data} config={configData} /> : null}

      <main className="flex flex-col gap-4">
        {accountsData.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No accounts yet. Create your first account to get started.
            </p>
            <p className="mt-4">
              <Button onClick={() => setIsCreating(true)}>+ New account</Button>
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Accounts
              </h2>
              <Button onClick={() => setIsCreating(true)}>+ New account</Button>
            </div>
            {accountsData.map((account) => (
              <AccountCard key={account.id} account={account} config={configData} />
            ))}
          </>
        )}
      </main>

      {isCreating ? (
        <AccountForm
          title="New account"
          submitLabel="Create"
          isPending={createAccount.isPending}
          errorMessage={createAccount.error?.message}
          onClose={() => setIsCreating(false)}
          onSubmit={(name) => createAccount.mutate(name, { onSuccess: () => setIsCreating(false) })}
        />
      ) : null}

      {isEditingWatchlist ? (
        <WatchlistEditor items={watchlistItems} onClose={() => setIsEditingWatchlist(false)} />
      ) : null}

      <AppFooter />
    </div>
  );
};
