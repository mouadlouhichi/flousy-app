export type ProUserLike = {
  plan?: string | null;
} | null;

export interface ProFeature {
  id: string;
  /** Icon identifier understood by `AppIcon`. */
  icon: string;
  title: string;
  description: string;
}

/**
 * Everything the Pro plan unlocks, surfaced on the profile page so users can
 * see what they have (or what they'd get by upgrading) in one place.
 */
export const PRO_FEATURES: ProFeature[] = [
  {
    id: 'trends',
    icon: 'trending_up',
    title: 'Trends & Analytics',
    description: 'Multi-month charts comparing income, envelopes and spend over time.',
  },
  {
    id: 'income-sources',
    icon: 'payments',
    title: 'Multiple Income Sources',
    description: 'Track salary, freelance and side income separately in one budget.',
  },
  {
    id: 'csv',
    icon: 'upload_file',
    title: 'CSV Import & Export',
    description: 'Bulk-import statements and export your full history any time.',
  },
  {
    id: 'category-budgets',
    icon: 'category',
    title: 'Category Budgets',
    description: 'Set a planned maximum per category with alerts before you overspend.',
  },
  {
    id: 'rollover',
    icon: 'sync',
    title: 'Budget Rollover',
    description: 'Carry unused category budget into next month automatically.',
  },
  {
    id: 'household',
    icon: 'family_restroom',
    title: 'Household Members',
    description: 'Attribute expenses to family members and see who spends what.',
  },
];

export function isProUser(
  profile: ProUserLike,
  storage: Pick<Storage, 'getItem'> = typeof window !== 'undefined' ? window.localStorage : undefined as never,
): boolean {
  if (!profile) return false;
  if (profile.plan === 'pro') return true;

  if (storage?.getItem?.('flousy_pro_plan') === 'true') return true;
  return false;
}
