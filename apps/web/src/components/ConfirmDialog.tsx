import { Modal } from './Modal';
import { Button, FormActions } from './ui';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting...',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal title={title} onClose={onCancel} isLocked={isPending}>
    <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    <FormActions>
      <Button variant="secondary" onClick={onCancel} disabled={isPending}>
        Cancel
      </Button>
      <Button variant="danger" onClick={onConfirm} disabled={isPending}>
        {isPending ? pendingLabel : confirmLabel}
      </Button>
    </FormActions>
  </Modal>
);
