import { type FormEvent, useState } from 'react';

import Big from 'big.js';

import { currencyFieldProps, maskMoneyInput, unmaskMoney } from '../lib/format';
import { useIsDesktop } from '../lib/useIsDesktop';
import { validateCash } from '../lib/validation';
import type { Account, AppConfig, CashInput } from '../types';
import { Modal } from './Modal';
import { Button, Field, FormActions } from './ui';

type CashEditorProps = {
  account: Account;
  config: AppConfig;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (cash: CashInput) => void;
  onClose: () => void;
};

// Empty input, or an amount of 0, clears the cash (treated the same as removal).
const toNullable = (value: string): string | null => {
  const trimmed = unmaskMoney(value).trim();
  if (trimmed === '') return null;

  try {
    return new Big(trimmed).eq(0) ? null : trimmed;
  } catch {
    return trimmed;
  }
};

export const CashEditor = ({
  account,
  config,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: CashEditorProps) => {
  const [primary, setPrimary] = useState(maskMoneyInput(account.cashPrimary ?? ''));
  const [secondary, setSecondary] = useState(maskMoneyInput(account.cashSecondary ?? ''));
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const { secondaryCurrency } = config;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const primaryValidation = validateCash(primary);
    const secondaryValidation = secondaryCurrency ? validateCash(secondary) : null;
    setPrimaryError(primaryValidation);
    setSecondaryError(secondaryValidation);
    if (primaryValidation || secondaryValidation) return;

    const cash: CashInput = { primary: toNullable(primary) };
    if (secondaryCurrency) {
      cash.secondary = toNullable(secondary);
    }

    onSubmit(cash);
  };

  return (
    <Modal title="Edit cash" onClose={onClose} isLocked={isPending}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label={`Cash (${config.primaryCurrency.code})`}
          value={primary}
          inputMode="decimal"
          {...currencyFieldProps(config.primaryCurrency)}
          placeholder="e.g. 1500.00"
          hint="Leave empty to remove"
          error={primaryError}
          onChange={(event) => setPrimary(maskMoneyInput(event.target.value))}
          autoFocus={isDesktop}
        />
        {secondaryCurrency ? (
          <Field
            label={`Cash (${secondaryCurrency.code})`}
            value={secondary}
            inputMode="decimal"
            {...currencyFieldProps(secondaryCurrency)}
            placeholder="e.g. 250000"
            hint={`Leave empty to remove`}
            error={secondaryError}
            onChange={(event) => setSecondary(maskMoneyInput(event.target.value))}
          />
        ) : null}
        {errorMessage ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save cash'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};
