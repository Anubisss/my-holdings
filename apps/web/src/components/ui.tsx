import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 disabled:opacity-50',
  secondary:
    'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
  danger:
    'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 disabled:opacity-50',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = ({ variant = 'primary', className = '', ...props }: ButtonProps) => (
  <button
    className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
    {...props}
  />
);

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
  /** Optional symbol rendered inside the input on the leading edge (e.g. "$"). */
  prefix?: string;
  /** Optional symbol rendered inside the input on the trailing edge (e.g. "Ft"). */
  suffix?: string;
};

export const Field = ({
  label,
  error,
  hint,
  prefix,
  suffix,
  id,
  className = '',
  ...props
}: FieldProps) => {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-sm text-slate-500 dark:text-slate-400"
          >
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`w-full rounded-lg border border-slate-300 bg-white py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'} ${className}`}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          {...props}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 text-sm text-slate-500 dark:text-slate-400"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint && !error ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
};

export const FormActions = ({ children }: { children: ReactNode }) => (
  <div className="mt-2 flex justify-end gap-2">{children}</div>
);

export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
    <span
      aria-hidden="true"
      className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400"
    />
    <span className="text-sm text-slate-500 dark:text-slate-400">{label ?? 'Loading...'}</span>
  </div>
);
