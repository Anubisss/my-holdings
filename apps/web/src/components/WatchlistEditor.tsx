import { type FormEvent, useState } from 'react';

import {
  useCreateWatchlistItem,
  useDeleteWatchlistItem,
  useUpdateWatchlistItem,
} from '../api/hooks';
import { sanitizeWatchlistTicker, validateWatchlistTicker } from '../lib/validation';
import type { WatchlistItem } from '../types';
import { Modal } from './Modal';
import { Button } from './ui';

type WatchlistEditorProps = {
  items: WatchlistItem[];
  onClose: () => void;
};

// The actions column is a fixed width (not `auto`) so its content can't shift
// the flexible columns out of sync between the header and the rows, which would
// otherwise leave the "Pinned" label sitting over the buttons.
const COLS = 'sm:grid sm:grid-cols-[1fr_1fr_5rem_10.5rem] sm:items-center sm:gap-2';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

const checkboxClass =
  'h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800';

const WatchlistEditorRow = ({ item }: { item: WatchlistItem }) => {
  const updateItem = useUpdateWatchlistItem();
  const deleteItem = useDeleteWatchlistItem();
  const [ticker, setTicker] = useState(item.ticker);
  const [displayName, setDisplayName] = useState(item.displayName ?? '');
  const [pinned, setPinned] = useState(item.pinned);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isDirty =
    ticker !== item.ticker || displayName !== (item.displayName ?? '') || pinned !== item.pinned;

  const handleSave = () => {
    const validationError = validateWatchlistTicker(ticker);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    updateItem.mutate(
      {
        id: item.id,
        input: { ticker: ticker.trim(), displayName: displayName.trim() || null, pinned },
      },
      { onError: (mutationError) => setError(mutationError.message) },
    );
  };

  const isBusy = updateItem.isPending || deleteItem.isPending;

  return (
    <div className={`flex flex-col gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50 ${COLS}`}>
      <input
        aria-label="Ticker"
        className={`${inputClass} uppercase`}
        value={ticker}
        onChange={(event) => setTicker(sanitizeWatchlistTicker(event.target.value))}
      />
      <input
        aria-label="Display name"
        className={inputClass}
        placeholder="Optional name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <label className="flex items-center gap-2 sm:justify-center">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={pinned}
          onChange={(event) => setPinned(event.target.checked)}
        />
        <span className="text-sm text-slate-600 sm:hidden dark:text-slate-300">Pinned</span>
      </label>
      <div className="flex shrink-0 justify-end gap-1">
        {confirmingDelete ? (
          <>
            <Button variant="danger" disabled={isBusy} onClick={() => deleteItem.mutate(item.id)}>
              Confirm
            </Button>
            <Button variant="ghost" disabled={isBusy} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={!isDirty || isBusy} onClick={handleSave}>
              {updateItem.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              aria-label={`Delete ${item.ticker}`}
              disabled={isBusy}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          </>
        )}
      </div>
      {error ? (
        <p className="text-xs text-red-600 sm:col-span-4 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
};

const AddWatchlistItem = () => {
  const createItem = useCreateWatchlistItem();
  const [ticker, setTicker] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();

    const validationError = validateWatchlistTicker(ticker);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    createItem.mutate(
      { ticker: ticker.trim(), displayName: displayName.trim() || null, pinned },
      {
        onSuccess: () => {
          setTicker('');
          setDisplayName('');
          setPinned(false);
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <form
      onSubmit={handleAdd}
      className={`flex flex-col gap-2 rounded-lg border border-slate-300 p-3 dark:border-slate-700 ${COLS}`}
    >
      <div className="block sm:hidden text-lg font-semibold text-center text-slate-800 dark:text-slate-400 mb-2">
        New watchlist item
      </div>
      <input
        aria-label="New ticker"
        className={`${inputClass} uppercase`}
        placeholder="e.g. ^GSPC"
        value={ticker}
        onChange={(event) => setTicker(sanitizeWatchlistTicker(event.target.value))}
      />
      <input
        aria-label="New display name"
        className={inputClass}
        placeholder="Optional name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <label className="flex items-center gap-2 sm:justify-center">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={pinned}
          onChange={(event) => setPinned(event.target.checked)}
        />
        <span className="text-sm text-slate-600 sm:hidden dark:text-slate-300">Pinned</span>
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={createItem.isPending}>
          {createItem.isPending ? 'Adding...' : 'Add'}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-red-600 sm:col-span-4 dark:text-red-400">{error}</p>
      ) : null}
    </form>
  );
};

export const WatchlistEditor = ({ items, onClose }: WatchlistEditorProps) => (
  <Modal title="Edit watchlist" onClose={onClose} size="lg">
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add tickers to watch. Use a display name for a friendlier label, and pin items (e.g. FX,
        indices) to keep them at the top.
      </p>

      <AddWatchlistItem />

      <div
        className={`hidden px-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid dark:text-slate-500 ${COLS}`}
      >
        <span>Ticker</span>
        <span>Display name</span>
        <span className="text-center">Pinned</span>
        <span className="sr-only">Actions</span>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <WatchlistEditorRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">Your watchlist is empty.</p>
      )}

      <div className="mt-1 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  </Modal>
);
