import { type FormEvent, useState } from 'react';

import { useSaveNote } from '../api/hooks';
import { Modal } from './Modal';
import { Button, FormActions } from './ui';

const MAX_LENGTH = 2000;

type NoteEditorProps = {
  ticker: string;
  name: string;
  initialBody: string;
  onClose: () => void;
};

export const NoteEditor = ({ ticker, name, initialBody, onClose }: NoteEditorProps) => {
  const [body, setBody] = useState(initialBody);
  const saveNote = useSaveNote();

  const isUnchanged = body.trim() === initialBody.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    saveNote.mutate({ ticker, body: body.trim() }, { onSuccess: onClose });
  };

  return (
    <Modal title={`Note - ${name}`} onClose={onClose} isLocked={saveNote.isPending} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="note-body"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Note
          </label>
          <textarea
            id="note-body"
            rows={8}
            value={body}
            maxLength={MAX_LENGTH}
            placeholder="Anything worth remembering about this stock"
            onChange={(event) => setBody(event.target.value)}
            className="w-full min-h-[18rem] sm:min-h-[16rem] resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {saveNote.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{saveNote.error.message}</p>
          )}
        </div>
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saveNote.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveNote.isPending || isUnchanged}>
            {saveNote.isPending ? 'Saving...' : 'Save'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};
