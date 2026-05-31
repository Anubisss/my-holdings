/**
 * Masks free user input into a `YYYY/MM/DD` shape. The `/` separator is shown
 * as soon as a segment is complete (e.g. "2024" -> "2024/"), i.e. before the
 * next segment rather than after typing into it. `previous` is the prior value
 * so deleting an auto-inserted separator also removes the preceding digit
 * instead of getting stuck on the slash.
 */
export const maskDateInput = (raw: string, previous = ''): string => {
  let digits = raw.replace(/\D/g, '');

  const isDeleting = raw.length < previous.length;
  if (isDeleting && previous.endsWith('/') && !raw.endsWith('/')) {
    digits = digits.slice(0, -1);
  }

  digits = digits.slice(0, 8);

  let result = digits.slice(0, 4);
  if (digits.length >= 4) result += `/${digits.slice(4, 6)}`;
  if (digits.length >= 6) result += `/${digits.slice(6, 8)}`;
  return result;
};

/** Converts `YYYY/MM/DD` display value to the API's `YYYY-MM-DD` form. */
export const displayToIso = (display: string): string => display.replace(/\//g, '-');

/** Converts the API's `YYYY-MM-DD` form to the `YYYY/MM/DD` display value. */
export const isoToDisplay = (iso: string): string => iso.replace(/-/g, '/');

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

/** Formats an ISO `YYYY-MM-DD` date for display, e.g. "Sept 05, 2026". */
export const formatDateDisplay = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;

  const [, year, month, day] = match;
  const monthName = MONTH_ABBREVIATIONS[Number(month) - 1] ?? month;

  return `${monthName} ${day}, ${year}`;
};

export const todayIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

/** Validates a `YYYY/MM/DD` display value: real date, today or earlier. */
export const validateDisplayDate = (display: string): string | null => {
  const iso = displayToIso(display);

  if (!isValidIsoDate(iso)) return 'Enter a valid date as YYYY/MM/DD';
  if (iso > todayIso()) return 'Date must be today or earlier';

  return null;
};
