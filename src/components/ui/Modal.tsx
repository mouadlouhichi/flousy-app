'use client';

import { AppIcon } from '@/components/ui/app-icon';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { useLanguage } from '@/lib/i18n-context';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Stack of currently open modals (topmost last). Escape must only dismiss the
 * TOPMOST dialog: every instance listens on `window`, so without this a
 * nested confirm sheet and its parent modal both closed on one key press.
 */
const openModalStack: symbol[] = [];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // offsetParent is null for display:none subtrees (and position:fixed,
    // which doesn't occur inside the sheet body).
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function Modal({ isOpen, onClose, title, children, triggerRef, className = '' }: ModalProps) {
  const { messages: m } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef<symbol | null>(null);
  if (modalIdRef.current === null) modalIdRef.current = Symbol('modal');
  const reduceMotion = useReducedMotion();

  // Portals need a client-side document; also gates SSR rendering.
  const [isBrowser, setIsBrowser] = useState(false);
  useEffect(() => setIsBrowser(true), []);

  // Bottom-sheet layout lives below the `sm` breakpoint (see the container
  // classes below: `items-end sm:items-center`), so match it exactly.
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsMobileSheet(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Lock background scroll, trap Tab, and handle Escape (topmost dialog only)
  useEffect(() => {
    if (!isOpen) return;

    // Store the element that had focus before modal opened
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    const modalId = modalIdRef.current!;
    openModalStack.push(modalId);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the top of the stack reacts, so a nested confirm dialog's
      // Escape no longer also dismisses the sheet underneath it.
      if (openModalStack[openModalStack.length - 1] !== modalId) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap (WCAG 2.4.3): Tab cycles inside the dialog instead of
      // escaping into the inert-looking background page.
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = visibleFocusables(modalRef.current);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = active instanceof HTMLElement && modalRef.current.contains(active);
        if (e.shiftKey) {
          if (!inside || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (!inside || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus first focusable element inside modal
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const focusableElements = visibleFocusables(modalRef.current);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    });

    // Captured now rather than read in the cleanup: by the time this effect is
    // disposed React may already have moved the node `triggerRef` points at, so
    // reading `.current` there restores focus to the wrong element (or none).
    const effectTrigger = triggerRef?.current;

    return () => {
      const stackIndex = openModalStack.indexOf(modalId);
      if (stackIndex !== -1) openModalStack.splice(stackIndex, 1);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element on close
      const restoreTarget = effectTrigger || previouslyFocusedRef.current;
      if (restoreTarget && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [isOpen, onClose, triggerRef]);

  // Enter/exit motion. On mobile the sheet pops up from the bottom edge with
  // a spring; on desktop the centered dialog fades in with a slight rise.
  // The mobile sheet stays at opacity 1 throughout — it slides rather than
  // fades, so the panel is always fully opaque and never lets the page bleed
  // through its surface.
  const sheetInitial = reduceMotion
    ? { opacity: 0 }
    : isMobileSheet
      ? { y: '110%', opacity: 1 }
      : { opacity: 0, scale: 0.96, y: 16 };
  const sheetAnimate = reduceMotion
    ? { opacity: 1 }
    : isMobileSheet
      ? { y: '0%', opacity: 1 }
      : { opacity: 1, scale: 1, y: 0 };
  const sheetExit = reduceMotion
    ? { opacity: 0 }
    : isMobileSheet
      ? { y: '110%', opacity: 1 }
      : { opacity: 0, scale: 0.97, y: 8 };
  const sheetTransition: Transition = reduceMotion
    ? { duration: 0.15 }
    : isMobileSheet
      ? { type: 'spring', stiffness: 400, damping: 32, mass: 0.9 }
      : { duration: 0.22, ease: [0.32, 0.72, 0, 1] };

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        // The container must NOT animate opacity: CSS opacity applies to the
        // whole subtree, so a fading wrapper drags the opaque panel down with
        // it and the page shows through the sheet. The scrim and the panel
        // each animate their own opacity instead. AnimatePresence still waits
        // for these nested exit animations before unmounting.
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-margin-mobile md:p-margin-desktop"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Blurred scrim as a SIBLING of the panel. Nesting the dialog inside
              a `backdrop-filter` layer makes mobile browsers rasterize its
              text at a lower resolution — that's what made the sheet look
              fuzzy ("flou") on phones. */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-surface/60 backdrop-blur-[8px]"
            onClick={onClose}
          />

          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={sheetInitial}
            animate={sheetAnimate}
            exit={sheetExit}
            transition={sheetTransition}
            // Drop the compositing hint once the sheet lands so the browser
            // re-rasterizes the text crisply instead of leaving the scaled
            // animation snapshot on screen.
            onAnimationComplete={() => {
              if (modalRef.current) modalRef.current.style.willChange = 'auto';
            }}
            className={`relative z-10 w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] border border-outline-variant overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] ${className}`}
          >
            {/* Drag handle on mobile */}
            <div className="w-full flex justify-center pt-2 pb-1 sm:hidden">
              <div className="w-12 h-1.5 bg-outline-variant rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-4 py-2 sm:px-lg sm:pt-sm sm:pb-md flex justify-between items-center border-b border-surface-variant">
              <h2 className="font-headline-sm sm:font-headline-md text-headline-sm sm:text-headline-md text-on-surface">{title}</h2>
              <button
                onClick={onClose}
                aria-label={m.modal.close}
                className="tap-target p-1.5 sm:p-2 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary "
              >
                <AppIcon name="close" className="  text-[20px] sm:text-[24px] !block" />
              </button>
            </div>

            {/* Body */}
            <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-lg">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render into <body> so the sheet escapes the dashboard's animated
  // (transformed) page container — a transformed ancestor both re-anchors
  // `position: fixed` and blurs the layer while it animates.
  if (!isBrowser) return null;
  return createPortal(overlay, document.body);
}
