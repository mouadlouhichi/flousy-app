import { useEffect } from 'react';

export type QuickActionId = 'expense' | 'charge' | 'savings' | 'courses';

type Handler = (id: QuickActionId) => void;

const listeners = new Set<Handler>();

export function emitQuickAction(id: QuickActionId) {
  listeners.forEach((fn) => fn(id));
}

export function useQuickActionHandler(handler: Handler) {
  useEffect(() => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [handler]);
}
