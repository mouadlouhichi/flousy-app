import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, triggerRef, className = '' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock background scroll & handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus trap inside modal
    if (modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to trigger element on close
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface/60 backdrop-blur-[8px] p-margin-mobile md:p-margin-desktop transition-opacity"
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] border border-outline-variant overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh] ${className}`}
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
            aria-label="Close modal"
            className="p-1.5 sm:p-2 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[24px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-lg overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
