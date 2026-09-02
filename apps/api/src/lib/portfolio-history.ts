import Big from 'big.js';
import { asc } from 'drizzle-orm';

import { config } from '../config.js';
import { db, sqlite } from '../db/client.js';
import { portfolioValueHistory } from '../db/schema.js';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RE = /^\d+(\.\d{1,2})?$/;

const hasSecondary = config.secondaryCurrency !== null;
const primaryCode = config.primaryCurrency.code;
const secondaryCode = config.secondaryCurrency?.code ?? null;

const buildHeaders = (includeCreatedAt: boolean): string[] => {
  const h = ['id', 'date', `value primary (${primaryCode})`];
  if (hasSecondary) {
    h.push(`value secondary (${secondaryCode})`);
    h.push('currency rate');
  }
  if (includeCreatedAt) h.push('created at (UTC)');
  return h;
};

const HEADERS_WITH_CREATED_AT = buildHeaders(true);
const HEADERS_WITHOUT_CREATED_AT = buildHeaders(false);

const toExcelCol = (colIndex: number): string => {
  let col = '';
  let n = colIndex;
  while (n >= 0) {
    col = String.fromCharCode((n % 26) + 65) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
};

const cellRef = (col: number, row: number): string => `${toExcelCol(col)}${row}`;

const formatCreatedAt = (raw: string | null): string => {
  if (!raw) return '';
  if (raw.endsWith('Z')) return raw;
  if (raw.includes('T')) return `${raw}Z`;
  return `${raw.replace(' ', 'T')}Z`;
};

const formatDecimal = (value: string | null): string => {
  if (value === null || value === '') return '';
  return new Big(value).toFixed(2);
};

const isValidDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
};

const parseCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
};

export type ExportResult = { csv: string; filename: string };

export const exportCsv = (): ExportResult => {
  const rows = db
    .select()
    .from(portfolioValueHistory)
    .orderBy(asc(portfolioValueHistory.date))
    .all();

  const headers = buildHeaders(rows.length > 0);
  const lines: string[] = [headers.join(',')];

  for (const row of rows) {
    const fields: string[] = [row.id, row.date, formatDecimal(row.valuePrimary)];
    if (hasSecondary) {
      fields.push(formatDecimal(row.valueSecondary ?? null));
      fields.push(formatDecimal(row.currencyRate ?? null));
    }
    fields.push(formatCreatedAt(row.createdAt));
    lines.push(fields.join(','));
  }

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');

  return {
    csv: lines.join('\n') + '\n',
    filename: `myholdings_portfolio_value_history_${y}_${m}_${d}.csv`,
  };
};

type ParsedRow = {
  id: string;
  date: string;
  valuePrimary: string;
  valueSecondary: string | null;
  currencyRate: string | null;
};

export type ImportValidationError = { error: string; errors: string[] };
export type ImportSuccess = { imported: number };
export type ImportResult = ImportSuccess | ImportValidationError;

export const isImportError = (r: ImportResult): r is ImportValidationError => 'errors' in r;

const validateHeader = (rawLine: string): { includesCreatedAt: boolean } => {
  const actual = parseCsvLine(rawLine).map((h) => h.toLowerCase());
  const withCreated = HEADERS_WITH_CREATED_AT.map((h) => h.toLowerCase());
  const withoutCreated = HEADERS_WITHOUT_CREATED_AT.map((h) => h.toLowerCase());

  if (actual.length === withCreated.length && actual.every((h, i) => h === withCreated[i])) {
    return { includesCreatedAt: true };
  }
  if (actual.length === withoutCreated.length && actual.every((h, i) => h === withoutCreated[i])) {
    return { includesCreatedAt: false };
  }

  const expected = hasSecondary
    ? `id, date, value primary (${primaryCode}), value secondary (${secondaryCode}), currency rate`
    : `id, date, value primary (${primaryCode})`;
  throw new Error(`Invalid CSV header. Expected columns: ${expected}`);
};

const validateRows = (
  dataLines: string[],
  expectedColCount: number,
): { parsed: ParsedRow[]; errors: string[] } => {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenDates = new Set<string>();
  const parsed: ParsedRow[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const csvRow = i + 2; // 1-indexed, row 1 is header
    const fields = parseCsvLine(dataLines[i]);

    if (fields.length !== expectedColCount) {
      errors.push(`Row ${csvRow}: expected ${expectedColCount} columns but got ${fields.length}`);
      continue;
    }

    let colIdx = 0;

    const id = fields[colIdx];
    if (!id) {
      errors.push(`${cellRef(colIdx, csvRow)}: id is required`);
    } else if (!UUID_V4_RE.test(id)) {
      errors.push(`${cellRef(colIdx, csvRow)}: id must be a valid UUID v4`);
    } else if (seenIds.has(id.toLowerCase())) {
      errors.push(`${cellRef(colIdx, csvRow)}: duplicate id "${id}"`);
    } else {
      seenIds.add(id.toLowerCase());
    }
    colIdx++;

    const date = fields[colIdx];
    if (!date) {
      errors.push(`${cellRef(colIdx, csvRow)}: date is required`);
    } else if (!isValidDate(date)) {
      errors.push(
        `${cellRef(colIdx, csvRow)}: date must be a valid date in YYYY-MM-DD format (e.g. 2026-12-24)`,
      );
    } else if (seenDates.has(date)) {
      errors.push(`${cellRef(colIdx, csvRow)}: duplicate date "${date}"`);
    } else {
      seenDates.add(date);
    }
    colIdx++;

    const valuePrimary = fields[colIdx];
    if (!valuePrimary) {
      errors.push(`${cellRef(colIdx, csvRow)}: value primary is required`);
    } else if (!DECIMAL_RE.test(valuePrimary)) {
      errors.push(
        `${cellRef(colIdx, csvRow)}: value primary must be a number with at most 2 decimal places using "." (e.g. 1234.56)`,
      );
    }
    colIdx++;

    let valueSecondary: string | null = null;
    let currencyRate: string | null = null;

    if (hasSecondary) {
      const vsRaw = fields[colIdx];
      if (vsRaw) {
        if (!DECIMAL_RE.test(vsRaw)) {
          errors.push(
            `${cellRef(colIdx, csvRow)}: value secondary must be a number with at most 2 decimal places using "." (e.g. 1234.56)`,
          );
        } else {
          valueSecondary = vsRaw;
        }
      }
      colIdx++;

      const crRaw = fields[colIdx];
      if (crRaw) {
        if (!DECIMAL_RE.test(crRaw)) {
          errors.push(
            `${cellRef(colIdx, csvRow)}: currency rate must be a number with at most 2 decimal places using "." (e.g. 350.25)`,
          );
        } else {
          currencyRate = crRaw;
        }
      }
      colIdx++;

      const hasVs = vsRaw !== '';
      const hasCr = crRaw !== '';
      if (hasVs && !hasCr) {
        errors.push(`Row ${csvRow}: currency rate is required when value secondary is provided`);
      } else if (!hasVs && hasCr) {
        errors.push(`Row ${csvRow}: value secondary is required when currency rate is provided`);
      }
    }

    parsed.push({
      id: id || '',
      date: date || '',
      valuePrimary: valuePrimary || '0',
      valueSecondary,
      currencyRate,
    });
  }

  return { parsed, errors };
};

const replaceAll = (rows: ParsedRow[]): number => {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const insertStmt = sqlite.prepare(
    hasSecondary
      ? `INSERT INTO portfolio_value_history (id, date, value_primary, value_secondary, currency_rate, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      : `INSERT INTO portfolio_value_history (id, date, value_primary, created_at) VALUES (?, ?, ?, ?)`,
  );
  const deleteAll = sqlite.prepare('DELETE FROM portfolio_value_history');

  const runTransaction = sqlite.transaction(() => {
    deleteAll.run();
    for (const row of rows) {
      const vp = new Big(row.valuePrimary).toFixed(2);
      if (hasSecondary) {
        const vs = row.valueSecondary ? new Big(row.valueSecondary).toFixed(2) : null;
        const cr = row.currencyRate ? new Big(row.currencyRate).toFixed(2) : null;
        insertStmt.run(row.id, row.date, vp, vs, cr, now);
      } else {
        insertStmt.run(row.id, row.date, vp, now);
      }
    }
  });

  runTransaction();
  return rows.length;
};

export const importCsv = (content: string): ImportResult => {
  const rawLines = content.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (rawLines.length === 0) {
    return { error: 'The CSV file is empty', errors: [] };
  }

  let includesCreatedAt: boolean;
  try {
    ({ includesCreatedAt } = validateHeader(rawLines[0]));
  } catch (err) {
    return { error: (err as Error).message, errors: [] };
  }

  const dataLines = rawLines.slice(1);
  if (dataLines.length === 0) {
    return {
      error: 'The CSV contains no data rows (only a header). At least one data row is required.',
      errors: [],
    };
  }

  const expectedColCount = includesCreatedAt
    ? HEADERS_WITH_CREATED_AT.length
    : HEADERS_WITHOUT_CREATED_AT.length;

  const { parsed, errors } = validateRows(dataLines, expectedColCount);

  if (errors.length > 0) {
    return { error: 'Validation failed', errors };
  }

  const imported = replaceAll(parsed);
  return { imported };
};
