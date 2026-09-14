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

// Whether a touch that landed on `target` has something inside the dialog that
// can scroll it — the dialog's own scroll box, or a nested scroller such as a
// `textarea` with overflowing text. When nothing can, iOS hands the drag to the
// page behind the modal, so the caller cancels it instead.
const canConsumeScroll = (target: EventTarget | null, dialog: HTMLElement | null) => {
  if (!dialog || !(target instanceof Node)) return false;

  let element = target instanceof HTMLElement ? target : target.parentElement;
  while (element && dialog.contains(element)) {
    const { overflowY } = getComputedStyle(element);
    const isScroller = overflowY === 'auto' || overflowY === 'scroll';
    if (isScroller && element.scrollHeight > element.clientHeight) return true;
    element = element.parentElement;
  }

  return false;
};

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

  // Lock scrolling on the page behind the modal while it's open. `overflow:
  // hidden` goes on the root element as well as the body: on the body alone it
  // only reaches the viewport through legacy propagation, which iOS honours for
  // wheel but not always for touch. Touch drags that start outside the dialog
  // are additionally cancelled by hand, since iOS can begin a touch scroll
  // before the listener exists. The body must not be pinned with `position:
  // fixed`: that resets the scroll offset, which Chrome on iOS reads as "back at
  // the top of the page", so it resizes its web view for the toolbars it is
  // about to show and leaves a strip of browser chrome below the page. React
  // registers `touchmove` passively at the root, hence the manual listener.
  useEffect(() => {
    const { body, documentElement: root } = document;
    const previous = { body: body.style.overflow, root: root.style.overflow };

    // Decided once per gesture: the check reads layout, which is too expensive
    // to repeat on every move event.
    let isDragAllowed = false;

    const handleTouchStart = (event: TouchEvent) => {
      isDragAllowed = canConsumeScroll(event.target, contentRef.current);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (isDragAllowed) return;
      if (event.cancelable) event.preventDefault();
    };

    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      body.style.overflow = previous.body;
      root.style.overflow = previous.root;
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
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
        className={`w-full ${modalSizes[size]} max-h-[min(85dvh,100%)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-slate-900 sm:max-h-[min(90vh,100%)]`}
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
