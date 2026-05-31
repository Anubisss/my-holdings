import Big from 'big.js';

/**
 * Validates and normalizes a money string using big.js so values are stored
 * precisely as text. Returns the normalized string, or null if invalid.
 * Rejects negative values.
 */
export const normalizeMoney = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    const big = new Big(trimmed);
    if (big.lt(0)) return null;
    return big.toString();
  } catch {
    return null;
  }
};

/**
 * Validates and normalizes a per-share price. Must be strictly positive.
 */
export const normalizePrice = (value: string): string | null => {
  const normalized = normalizeMoney(value);
  if (normalized === null) return null;
  if (new Big(normalized).lte(0)) return null;
  return normalized;
};
