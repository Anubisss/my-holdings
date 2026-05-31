import {
  formatCompactMoney,
  formatRoundedMoney,
  formatSignedCompactMoney,
  formatSignedRoundedMoney,
} from '../lib/format';
import type { Currency } from '../types';

type SecondaryMoneyProps = {
  /** Raw, unformatted value in the secondary currency. */
  value: string | null;
  /** Secondary currency, or null when none is configured. */
  currency: Currency | null;
  /** Show an explicit sign (for gains/losses). */
  signed?: boolean;
};

// Muted sub-line showing a value converted into the secondary currency,
// abbreviated (e.g. "1.13M") with the full, rounded value surfaced on hover.
// Renders nothing when there's no secondary currency or the conversion is
// unavailable (e.g. missing FX rate).
export const SecondaryMoney = ({ value, currency, signed = false }: SecondaryMoneyProps) => {
  if (!currency) return null;

  const compact = signed
    ? formatSignedCompactMoney(value, currency)
    : formatCompactMoney(value, currency);
  if (compact === null) return null;

  const full = signed
    ? formatSignedRoundedMoney(value, currency)
    : formatRoundedMoney(value, currency);

  return (
    <div
      className="cursor-help text-xs font-normal text-slate-400 dark:text-slate-500"
      title={full ?? compact}
    >
      {compact}
    </div>
  );
};
