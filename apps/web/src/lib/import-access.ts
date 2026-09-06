import type { HouseholdArea } from './household-rbac';
import type { Household } from './household';
import { isProFeatureUnlocked } from './household';
import { isProUser, type ProUserLike } from './pro-features';

export type BulkImportArea = Extract<HouseholdArea, 'expenses' | 'fixedBills'>;

type EntitlementHousehold = Pick<
  Household,
  'entitlementSource' | 'entitlementStatus' | 'entitlementEndsAtMs'
>;

export interface BulkImportAccessInput {
  profile: ProUserLike;
  workspace: 'personal' | 'household' | undefined;
  household?: EntitlementHousehold | null;
  canWriteArea: (area: BulkImportArea) => boolean;
  /** Explicit storage keeps demo-mode access testable; browsers use localStorage by default. */
  storage?: Pick<Storage, 'getItem'> | null;
  /** Capture one instant for both entitlement checks at this mutation boundary. */
  nowMs?: number;
}

export interface BulkImportAccess {
  entitled: boolean;
  areas: Record<BulkImportArea, boolean>;
}

/**
 * Resolve bulk-import access at the instant an importer opens or mutates data.
 * This must not be replaced with a render-time `isPro` boolean: a trial can
 * expire while an already-open modal is still holding its submit callback.
 */
export function resolveBulkImportAccess({
  profile,
  workspace,
  household,
  canWriteArea,
  storage,
  nowMs = Date.now(),
}: BulkImportAccessInput): BulkImportAccess {
  const personalEntitled = isProUser(profile, storage, nowMs);
  const entitled = isProFeatureUnlocked(personalEntitled, workspace, household, nowMs);

  return {
    entitled,
    areas: {
      expenses: entitled && canWriteArea('expenses'),
      fixedBills: entitled && canWriteArea('fixedBills'),
    },
  };
}
