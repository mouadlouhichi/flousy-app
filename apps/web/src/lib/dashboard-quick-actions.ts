import { EN_MESSAGES, type Messages } from './i18n-core';

export interface MobileQuickAction {
  id: 'expense' | 'charge' | 'savings' | 'courses';
  label: string;
  icon: string;
}

/** Labels are supplied by the active locale; IDs stay stable for actions. */
export function getMobileQuickActions(messages: Messages = EN_MESSAGES): MobileQuickAction[] {
  return [
    { id: 'expense', label: messages.modals.expense.addTitle, icon: 'payments' },
    { id: 'charge', label: messages.modals.fixed.addTitle, icon: 'receipt_long' },
    { id: 'savings', label: messages.modals.savings.createTitle, icon: 'savings' },
    { id: 'courses', label: messages.courses.start, icon: 'scan_barcode' },
  ];
}
