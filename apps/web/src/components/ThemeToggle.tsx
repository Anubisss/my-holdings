import type { ReactNode } from 'react';

import { type Theme, useTheme } from '../lib/theme';

const SunIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <circle cx="12" cy="12" r="4" />
    <path
      strokeLinecap="round"
      d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
    />
  </svg>
);

const MonitorIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path strokeLinecap="round" d="M8 20h8m-4-4v4" />
  </svg>
);

const MoonIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    className="h-4 w-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
    />
  </svg>
);

const options: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'auto', label: 'Auto (match system)', icon: MonitorIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

// Segmented light/auto/dark control. "Auto" follows the OS preference; the
// choice is persisted to localStorage by `useTheme`.
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-lg bg-slate-200 p-0.5 dark:bg-slate-800"
    >
      {options.map(({ value, label, icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
};
