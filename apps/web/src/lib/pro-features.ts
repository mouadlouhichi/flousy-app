export type ProUserLike = {
  plan?: string | null;
} | null;

export type ProFeatureId =
  | 'courseScan'
  | 'trends'
  | 'incomeSources'
  | 'csv'
  | 'categoryBudgets'
  | 'rollover'
  | 'household';

export interface ProFeature {
  id: ProFeatureId;
  /** Icon identifier understood by `AppIcon`. */
  icon: string;
}

/**
 * Everything the Pro plan unlocks. Display copy lives in the locale catalog,
 * while these stable IDs and icons stay independent of the interface language.
 */
export const PRO_FEATURES: ProFeature[] = [
  { id: 'courseScan', icon: 'scan_barcode' },
  { id: 'trends', icon: 'trending_up' },
  { id: 'incomeSources', icon: 'payments' },
  { id: 'csv', icon: 'upload_file' },
  { id: 'categoryBudgets', icon: 'category' },
  { id: 'rollover', icon: 'sync' },
  { id: 'household', icon: 'family_restroom' },
];

/**
 * Pro access is always resolved from the `plan` field stored on the Firebase
 * user profile (`users/{uid}.plan`) — never from a local flag. The localStorage
 * demo flag only applies in pure demo mode, where no Firebase profile exists.
 */
export function isProUser(
  profile: ProUserLike,
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): boolean {
  if (!profile) {
    // A Firebase user whose profile has not resolved yet is NOT a demo user, so
    // it must not be granted anything from local storage — that window (sign-in
    // → profile load) is exactly when a stale `flousy_pro_plan` flag from an
    // earlier demo session used to unlock Pro for a paying-tier feature set.
    // Only an explicitly active demo session may consult the flag.
    let demo = false;
    try {
      demo = storage?.getItem('flousy_demo_mode') === 'true';
    } catch {
      demo = false;
    }
    return demo && storage?.getItem('flousy_pro_plan') === 'true';
  }
  return profile.plan === 'pro';
}
