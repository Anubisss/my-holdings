import { type FormEvent, useState } from 'react';

import { isoToDisplay, maskDateInput, displayToIso, validateDisplayDate } from '../lib/date';
import { currencyFieldProps, maskMoneyInput, unmaskMoney } from '../lib/format';
import { useIsDesktop } from '../lib/useIsDesktop';
import {
  sanitizeHoldingTicker,
  validateAmount,
  validatePrice,
  validateTicker,
} from '../lib/validation';
import type { Currency, Holding, HoldingInput } from '../types';
import { Modal } from './Modal';
import { Button, Field, FormActions } from './ui';

type HoldingFormProps = {
  title: string;
  submitLabel: string;
  initial?: Holding;
  priceCurrency: Currency;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (input: HoldingInput) => void;
  onClose: () => void;
};

type Errors = {
  ticker?: string | null;
  date?: string | null;
  amount?: string | null;
  price?: string | null;
};

export const HoldingForm = ({
  title,
  submitLabel,
  initial,
  priceCurrency,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: HoldingFormProps) => {
  const [ticker, setTicker] = useState(initial?.ticker ?? '');
  const [date, setDate] = useState(initial ? isoToDisplay(initial.purchaseDate) : '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [price, setPrice] = useState(initial ? maskMoneyInput(initial.purchasePrice) : '');
  const [errors, setErrors] = useState<Errors>({});
  const isDesktop = useIsDesktop();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextErrors: Errors = {
      ticker: validateTicker(ticker),
      date: validateDisplayDate(date),
      amount: validateAmount(amount),
      price: validatePrice(price),
    };
    setErrors(nextErrors);
    if (nextErrors.ticker || nextErrors.date || nextErrors.amount || nextErrors.price) {
      return;
    }

    onSubmit({
      ticker: ticker.trim().toUpperCase(),
      purchaseDate: displayToIso(date),
      amount: Number.parseInt(amount, 10),
      purchasePrice: unmaskMoney(price).trim(),
    });
  };

  return (
    <Modal title={title} onClose={onClose} isLocked={isPending}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Ticker"
          value={ticker}
          maxLength={14}
          autoFocus={isDesktop}
          autoCapitalize="characters"
          placeholder="e.g. AAPL or BRK-B"
          hint="Letters, with an optional single dash"
          error={errors.ticker}
          onChange={(event) => setTicker(sanitizeHoldingTicker(event.target.value))}
        />
        <Field
          label="Purchase date"
          value={date}
          inputMode="numeric"
          placeholder="YYYY/MM/DD"
          hint="Format: YYYY/MM/DD"
          error={errors.date}
          onChange={(event) => setDate(maskDateInput(event.target.value, date))}
        />
        <Field
          label="Amount (shares)"
          value={amount}
          inputMode="numeric"
          placeholder="e.g. 10"
          error={errors.amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
        />
        <Field
          label="Purchase price (per share)"
          value={price}
          inputMode="decimal"
          {...currencyFieldProps(priceCurrency)}
          placeholder="e.g. 189.55"
          error={errors.price}
          onChange={(event) => setPrice(maskMoneyInput(event.target.value))}
        />
        {errorMessage ? (
          <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};
