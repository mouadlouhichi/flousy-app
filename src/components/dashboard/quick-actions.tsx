'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { getMobileQuickActions } from '@/lib/dashboard-quick-actions';
import { useDashboard } from './dashboard-provider';
import { getScreenIdFromPath } from './nav-items';

/** Floating quick-action button + expandable actions (mobile only). */
export function QuickActions() {
  const pathname = usePathname();
  const { openExpenseModal, openFixedModal, openSavingsModal } = useDashboard();
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const activeScreen = getScreenIdFromPath(pathname);
  // Screens with no "add" affordance hide the quick actions
  if (activeScreen === 'trends' || activeScreen === 'debts' || activeScreen === 'profile') {
    return null;
  }

  return (
    <>
      {isQuickActionsOpen && (
        <button
          type="button"
          aria-label="Close quick actions"
          className="md:hidden fixed inset-0 z-30 bg-transparent"
          onClick={() => setIsQuickActionsOpen(false)}
        />
      )}

      <div
        className={`md:hidden fixed bottom-38 right-5 z-40 flex flex-col items-end gap-2 transition-all duration-300 ease-out ${
          isQuickActionsOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-3 opacity-0 pointer-events-none'
        }`}
      >
        {getMobileQuickActions().map((action, index) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              setIsQuickActionsOpen(false);

              if (action.id === 'expense') {
                openExpenseModal();
              } else if (action.id === 'charge') {
                openFixedModal();
              } else if (action.id === 'savings') {
                openSavingsModal('create');
              }
            }}
            className="flex items-center gap-2 rounded-full bg-surface/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-outline-variant backdrop-blur-xl transition-all duration-300"
            style={{ transitionDelay: `${index * 70}ms` }}
            aria-label={action.label}
          >
            <span className="font-label-md text-label-md text-on-surface whitespace-nowrap">
              {action.label}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
              <AppIcon name={action.icon} className="text-[18px]" />
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setIsQuickActionsOpen((prev) => !prev)}
        className="md:hidden fixed bottom-22 right-5 z-40 h-14 w-14 bg-primary text-on-primary rounded-2xl shadow-[0_8px_24px_rgba(0,104,95,0.35)] flex items-center justify-center hover:bg-accent-foreground active:scale-95 transition-all"
        aria-label={isQuickActionsOpen ? 'Close quick actions' : 'Open quick actions'}
      >
        <AppIcon
          name={isQuickActionsOpen ? 'close' : 'add'}
          className={`text-[30px] transition-transform duration-300 ${
            isQuickActionsOpen ? 'rotate-45' : 'rotate-0'
          }`}
        />
      </button>
    </>
  );
}
