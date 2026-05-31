import { type MouseEvent, type ReactNode, useEffect, useRef } from 'react';

type ModalSize = 'md' | 'lg' | 'xl';

// Mobile shows the dialog as a full-width bottom sheet; the max width only
// applies from `sm` up so phones never get a narrow, centered box.
const modalSizes: Record<ModalSize, string> = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Visible, focusable descendants of `container`, in DOM order.
const getFocusable = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );

type ModalProps = {
  title: string;
  onClose: () => void;
  /** When true, the modal cannot be dismissed (e.g. while a save is in progress). */
  isLocked?: boolean;
  size?: ModalSize;
  children: ReactNode;
};

export const Modal = ({ title, onClose, isLocked = false, size = 'md', children }: ModalProps) => {
  // Tracks whether the current click sequence started on the backdrop itself.
  // This prevents the modal from closing when a text selection drag begins
  // inside the dialog and the mouse button is released over the backdrop.
  const pressStartedOnBackdrop = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open and restore it to the previously focused
  // element on close, so keyboard users aren't dropped back at the top of the page.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const content = contentRef.current;

    // Respect any child `autoFocus`: only pull focus in if it isn't already inside.
    if (content && !content.contains(document.activeElement)) {
      const [firstFocusable] = getFocusable(content);
      (firstFocusable ?? content).focus();
    }

    return () => previouslyFocused?.focus?.();
  }, []);

  // Handle Escape (close) and trap Tab focus within the dialog. Tab trapping
  // stays active even while locked; Escape is ignored while locked.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isLocked) onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const content = contentRef.current;
      if (!content) return;

      const focusable = getFocusable(content);
      if (focusable.length === 0) {
        event.preventDefault();
        content.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !content.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !content.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isLocked]);

  // Lock scrolling on the page behind the modal while it's open. Setting
  // `overflow: hidden` alone isn't enough on iOS Safari (it still touch-scrolls
  // the body), so we also pin the body with `position: fixed` at the current
  // scroll offset and restore both the styles and the scroll position on close.
  useEffect(() => {
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    pressStartedOnBackdrop.current = event.target === event.currentTarget;
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isLocked) return;
    if (event.target !== event.currentTarget) return;
    if (!pressStartedOnBackdrop.current) return;

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`w-full ${modalSizes[size]} max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-slate-900 sm:max-h-[90vh]`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isLocked}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              &times;
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
