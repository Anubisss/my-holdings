import { type FormEvent, useState } from 'react';

import { useIsDesktop } from '../lib/useIsDesktop';
import { validateAccountName } from '../lib/validation';
import { Modal } from './Modal';
import { Button, Field, FormActions } from './ui';

type AccountFormProps = {
  title: string;
  initialName?: string;
  submitLabel: string;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
};

export const AccountForm = ({
  title,
  initialName = '',
  submitLabel,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: AccountFormProps) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const validationError = validateAccountName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(name.trim());
  };

  return (
    <Modal title={title} onClose={onClose} isLocked={isPending}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Account name"
          value={name}
          maxLength={64}
          autoFocus={isDesktop}
          placeholder="e.g. Brokerage"
          error={error ?? errorMessage}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};
