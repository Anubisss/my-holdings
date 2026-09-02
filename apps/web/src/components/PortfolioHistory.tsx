import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiFetchBlob, type UploadResult } from '../api/client';
import { useImportPortfolioHistory } from '../api/hooks';
import type { AppConfig } from '../types';
import { Button, Spinner } from './ui';

type Props = {
  config: AppConfig;
};

const InfoBox = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
    {children}
  </div>
);

const WarningBox = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
    {children}
  </div>
);

const columnInfo = (config: AppConfig): string[] => {
  const { primaryCurrency, secondaryCurrency } = config;
  const lines = [
    `id — UUID v4 (e.g. 550e8400-e29b-41d4-a716-446655440000)`,
    `date — ISO 8601 date (e.g. 2026-12-24)`,
    `value primary (${primaryCurrency.code}) — number, max 2 decimal places (e.g. 12345.67)`,
  ];
  if (secondaryCurrency) {
    lines.push(
      `value secondary (${secondaryCurrency.code}) — optional, number, max 2 decimal places (e.g. 4567890.12)`,
    );
    lines.push(`currency rate — optional, number, max 2 decimal places (e.g. 350.25)`);
  }
  lines.push(`created at (UTC) — optional, ignored on import`);
  return lines;
};

export const PortfolioHistory = ({ config }: Props) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const importMutation = useImportPortfolioHistory();
  const [importResult, setImportResult] = useState<UploadResult | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await apiFetchBlob('/portfolio-history/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setImportResult(null);
  };

  const handleImport = () => {
    if (!selectedFile) return;
    setImportResult(null);
    importMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        setImportResult(data);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      onError: (err) => {
        setImportResult({ error: err.message, errors: [] });
      },
    });
  };

  const validationErrors = importResult && 'errors' in importResult ? importResult.errors : null;
  const importedCount = importResult && 'imported' in importResult ? importResult.imported : null;
  const importError =
    importResult && 'error' in importResult && !importResult.errors?.length
      ? importResult.error
      : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          aria-label="Back to portfolio"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Portfolio History</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your portfolio value history data. Charts coming soon.
        </p>
      </div>

      {/* Export */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Export
        </h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Export all portfolio history data as a CSV file.
        </p>
        {isExporting ? (
          <Spinner label="Exporting CSV..." />
        ) : (
          <Button onClick={handleExport}>Export CSV</Button>
        )}
        {exportError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{exportError}</p>
        ) : null}
      </section>

      {/* Import */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Import
        </h3>

        <div className="mb-4 flex flex-col gap-3">
          <WarningBox>
            Importing a CSV will <strong>replace all existing</strong> portfolio history data. The
            imported data becomes your new portfolio history.
          </WarningBox>

          <InfoBox>
            The CSV must match the export format. You can get a valid template by exporting your
            current data, even an empty export contains the correct header row.
          </InfoBox>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Expected columns
            </p>
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {columnInfo(config).map((line) => (
                <li key={line} className="font-mono">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-900 file:transition hover:file:bg-slate-300 dark:text-slate-300 dark:file:bg-slate-700 dark:file:text-slate-100 dark:hover:file:bg-slate-600"
            aria-label="Select CSV file"
            tabIndex={0}
          />
          <Button onClick={handleImport} disabled={!selectedFile || importMutation.isPending}>
            Import
          </Button>
        </div>

        {importMutation.isPending ? (
          <div className="mt-4">
            <Spinner label="Importing and validating..." />
          </div>
        ) : null}

        {importedCount !== null ? (
          <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            Successfully imported {importedCount} row{importedCount !== 1 ? 's' : ''}.
          </p>
        ) : null}

        {importError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {importError}
          </p>
        ) : null}

        {validationErrors && validationErrors.length > 0 ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">
              Validation errors ({validationErrors.length})
            </p>
            <ul className="max-h-60 space-y-1 overflow-y-auto text-xs font-mono text-red-700 dark:text-red-300">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
};
