import { useState } from 'react';

import {
  useCreateHolding,
  useDeleteAccount,
  useDeleteHolding,
  useRenameAccount,
  useUpdateCash,
  useUpdateHolding,
} from '../api/hooks';
import { formatDateDisplay } from '../lib/date';
import { formatMoney } from '../lib/format';
import type { Account, AppConfig, Holding } from '../types';
import { AccountForm } from './AccountForm';
import { CashEditor } from './CashEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { HoldingForm } from './HoldingForm';
import { HoldingRow, HoldingsHeader } from './HoldingRow';
import { Button } from './ui';

type AccountCardProps = {
  account: Account;
  config: AppConfig;
};

const fxNote = <span className="text-amber-600 dark:text-amber-400">No FX rate</span>;

type CashRowProps = {
  /** Currency label, e.g. "USD ($)". */
  label: string;
  /** The cash amount formatted in its own currency, or null when not set. */
  value: string | null;
  /** Whether a conversion sub-line should be shown (secondary currency enabled). */
  showConversion: boolean;
  /** Full conversion into the other currency (null when the FX rate is missing). */
  converted: string | null;
};

// A single cash bucket, styled like a holding row: currency label on the left
// (vertically centered), the amount on the right with the converted value beneath it.
const CashRow = ({ label, value, showConversion, converted }: CashRowProps) => {
  if (value === null) return null;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800">
      <span className="font-semibold text-slate-900 dark:text-slate-100">{label}</span>
      <div className="text-right">
        <div className="font-medium text-slate-700 dark:text-slate-200">{value}</div>
        {showConversion ? (
          converted === null ? (
            <div className="text-xs">{fxNote}</div>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500">{converted}</div>
          )
        ) : null}
      </div>
    </li>
  );
};

type Dialog =
  | { kind: 'none' }
  | { kind: 'rename' }
  | { kind: 'deleteAccount' }
  | { kind: 'cash' }
  | { kind: 'addHolding' }
  | { kind: 'editHolding'; holding: Holding }
  | { kind: 'deleteHolding'; holding: Holding };

export const AccountCard = ({ account, config }: AccountCardProps) => {
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const close = () => setDialog({ kind: 'none' });

  const renameAccount = useRenameAccount();
  const deleteAccount = useDeleteAccount();
  const updateCash = useUpdateCash();
  const createHolding = useCreateHolding();
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();

  const { primaryCurrency, secondaryCurrency } = config;

  // Each cash bucket is shown "as it is" plus converted into the other currency,
  // both as full values. The converted amounts are pre-computed by the backend;
  // here we only format.
  const primaryAsIs = formatMoney(account.cashPrimary, primaryCurrency);
  const secondaryAsIs = secondaryCurrency
    ? formatMoney(account.cashSecondary, secondaryCurrency)
    : null;
  const primaryConverted = secondaryCurrency
    ? formatMoney(account.cashPrimarySecondary, secondaryCurrency)
    : null;
  const secondaryConverted = secondaryCurrency
    ? formatMoney(account.cashSecondaryPrimary, primaryCurrency)
    : null;

  const hasPrimaryCash = primaryAsIs !== null;
  const hasSecondaryCash = secondaryAsIs !== null;
  const hasCash = hasPrimaryCash || hasSecondaryCash;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <header className="flex items-start justify-between gap-3">
        <h2 className="break-words text-lg font-semibold text-slate-900 dark:text-slate-100">
          {account.name}
        </h2>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" onClick={() => setDialog({ kind: 'rename' })}>
            Rename
          </Button>
          <Button variant="ghost" onClick={() => setDialog({ kind: 'deleteAccount' })}>
            Delete
          </Button>
        </div>
      </header>

      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Holdings
          </span>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'addHolding' })}>
            + Add holding
          </Button>
        </div>
        {account.holdings.length > 0 ? (
          <ul className="flex flex-col gap-2">
            <HoldingsHeader />
            {account.holdings.map((holding) => (
              <HoldingRow
                key={holding.id}
                holding={holding}
                currency={primaryCurrency}
                secondaryCurrency={secondaryCurrency}
                onEdit={() => setDialog({ kind: 'editHolding', holding })}
                onDelete={() => setDialog({ kind: 'deleteHolding', holding })}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No holdings yet</p>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Cash
          </span>
          <Button variant="secondary" onClick={() => setDialog({ kind: 'cash' })}>
            Edit
          </Button>
        </div>
        {hasCash ? (
          <ul className="flex flex-col gap-2">
            <CashRow
              label={`${primaryCurrency.code} (${primaryCurrency.symbol})`}
              value={primaryAsIs}
              showConversion={Boolean(secondaryCurrency)}
              converted={primaryConverted}
            />
            {secondaryCurrency ? (
              <CashRow
                label={`${secondaryCurrency.code} (${secondaryCurrency.symbol})`}
                value={secondaryAsIs}
                showConversion
                converted={secondaryConverted}
              />
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No cash added</p>
        )}
      </div>

      {dialog.kind === 'rename' ? (
        <AccountForm
          title="Rename account"
          initialName={account.name}
          submitLabel="Save"
          isPending={renameAccount.isPending}
          errorMessage={renameAccount.error?.message}
          onClose={close}
          onSubmit={(name) => renameAccount.mutate({ id: account.id, name }, { onSuccess: close })}
        />
      ) : null}

      {dialog.kind === 'deleteAccount' ? (
        <ConfirmDialog
          title="Delete account"
          message={`Delete "${account.name}" and all of its holdings?`}
          isPending={deleteAccount.isPending}
          onCancel={close}
          onConfirm={() => deleteAccount.mutate(account.id, { onSuccess: close })}
        />
      ) : null}

      {dialog.kind === 'cash' ? (
        <CashEditor
          account={account}
          config={config}
          isPending={updateCash.isPending}
          errorMessage={updateCash.error?.message}
          onClose={close}
          onSubmit={(cash) => updateCash.mutate({ id: account.id, cash }, { onSuccess: close })}
        />
      ) : null}

      {dialog.kind === 'addHolding' ? (
        <HoldingForm
          title={`Add holding - ${account.name}`}
          submitLabel="Add holding"
          priceCurrency={config.primaryCurrency}
          isPending={createHolding.isPending}
          errorMessage={createHolding.error?.message}
          onClose={close}
          onSubmit={(input) =>
            createHolding.mutate({ accountId: account.id, input }, { onSuccess: close })
          }
        />
      ) : null}

      {dialog.kind === 'editHolding' ? (
        <HoldingForm
          title="Edit holding"
          submitLabel="Save"
          initial={dialog.holding}
          priceCurrency={config.primaryCurrency}
          isPending={updateHolding.isPending}
          errorMessage={updateHolding.error?.message}
          onClose={close}
          onSubmit={(input) =>
            updateHolding.mutate({ id: dialog.holding.id, input }, { onSuccess: close })
          }
        />
      ) : null}

      {dialog.kind === 'deleteHolding' ? (
        <ConfirmDialog
          title="Delete holding"
          message={`Delete ${dialog.holding.amount} ${
            dialog.holding.amount === 1 ? 'share' : 'shares'
          } of ${dialog.holding.ticker}, purchased on ${formatDateDisplay(
            dialog.holding.purchaseDate,
          )}, from account ${account.name}?`}
          isPending={deleteHolding.isPending}
          onCancel={close}
          onConfirm={() => deleteHolding.mutate(dialog.holding.id, { onSuccess: close })}
        />
      ) : null}
    </section>
  );
};
