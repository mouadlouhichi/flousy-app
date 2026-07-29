export interface MobileQuickAction {
  id: 'expense' | 'charge' | 'savings';
  label: string;
  icon: string;
}

export function getMobileQuickActions(): MobileQuickAction[] {
  return [
    { id: 'expense', label: 'Add Expense', icon: 'payments' },
    { id: 'charge', label: 'Add Charge', icon: 'receipt_long' },
    { id: 'savings', label: 'New Savings Goal', icon: 'savings' },
  ];
}
