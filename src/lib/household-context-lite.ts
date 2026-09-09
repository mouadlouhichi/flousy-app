'use client';

import { createContext, useContext } from 'react';
import type { HouseholdContextValue } from './household-context';

/**
 * The Household context OBJECT, split from ./household-context on purpose.
 *
 * The provider module imports the whole Firestore data layer (./db) to run
 * its listeners. A plain `import { useOptionalHousehold } from
 * './household-context'` therefore dragged Firestore (~150 KiB) into every
 * consumer's bundle — including currency-context, which the /login page
 * mounts for every anonymous visitor. Type-only imports are erased at
 * compile time, so keeping the context object here (react-only) lets light
 * consumers read the context without paying for the provider's data layer.
 *
 * There is exactly ONE context instance: the provider in
 * ./household-context imports it from here too.
 */
export const HouseholdContext = createContext<HouseholdContextValue | null>(null);

/** Currency/auth providers are also used on login routes where no household provider exists. */
export function useOptionalHousehold(): HouseholdContextValue | null {
  return useContext(HouseholdContext);
}
