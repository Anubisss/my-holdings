/**
 * Returns today's date as an ISO `YYYY-MM-DD` string (local time).
 */
export const todayIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Validates that `value` is a real calendar date in `YYYY-MM-DD` form.
 */
export const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

/**
 * True when `value` is a valid date that is today or earlier.
 */
export const isTodayOrEarlier = (value: string): boolean => {
  if (!isValidIsoDate(value)) return false;
  return value <= todayIso();
};
