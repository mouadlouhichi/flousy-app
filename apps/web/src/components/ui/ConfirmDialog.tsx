import React from 'react';
import { Modal } from './Modal';
import { useLanguage } from '@/lib/i18n-context';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
}: ConfirmDialogProps) {
  const { messages: m } = useLanguage();
  const resolvedConfirmLabel = confirmLabel || m.common.confirm;
  const resolvedCancelLabel = cancelLabel || m.common.cancel;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-lg">
        <p className="font-body-md text-body-md text-on-surface-variant">{message}</p>
        <div className="flex justify-end gap-md pt-md border-t border-surface-variant">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-outline text-on-surface hover:bg-surface-variant/40 font-label-md text-label-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {resolvedCancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl font-label-md text-label-md text-white transition-colors focus:outline-none focus:ring-2 ${
              isDestructive
                ? 'bg-error hover:bg-error/90 focus:ring-error'
                : 'bg-primary hover:bg-accent-foreground focus:ring-primary'
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
