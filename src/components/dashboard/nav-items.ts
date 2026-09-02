import { EN_MESSAGES, type Messages } from '@/lib/i18n-core';

export type DashboardScreenId =
  | 'overview'
  | 'fixed'
  | 'variable'
  | 'courses'
  | 'savings'
  | 'trends'
  | 'debts'
  | 'profile';

export interface DashboardNavItem {
  id: DashboardScreenId;
  /** Route path for this screen */
  href: string;
  /** Icon used in the desktop sidebar */
  sidebarIcon: string;
  /** Icon used in the mobile bottom nav */
  mobileIcon: string;
  /** Screen only visible to PRO users */
  proOnly?: boolean;
  /**
   * Reachable screen that is intentionally absent from the sidebar / bottom
   * nav (e.g. the profile page, opened from the avatar button).
   */
  hiddenFromNav?: boolean;
}

/**
 * Ordered list of dashboard screens. The order defines both the navigation
 * order and the direction of the horizontal page transition (moving to a
 * higher index slides in from the right, a lower index from the left).
 */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: 'overview',
    href: '/dashboard',
    sidebarIcon: 'house',
    mobileIcon: 'house',
  },
  {
    id: 'fixed',
    href: '/dashboard/fixed',
    sidebarIcon: 'event_repeat',
    mobileIcon: 'receipt',
  },
  {
    id: 'variable',
    href: '/dashboard/variable',
    sidebarIcon: 'receipt_long',
    mobileIcon: 'shopping_cart',
  },
  {
    id: 'courses',
    href: '/dashboard/courses',
    sidebarIcon: 'scan_barcode',
    mobileIcon: 'scan_barcode',
    // Reached from the quick actions ("Start Course") rather than taking a
    // slot in the five-destination nav bars.
    hiddenFromNav: true,
  },
  {
    id: 'savings',
    href: '/dashboard/savings',
    sidebarIcon: 'savings',
    mobileIcon: 'savings',
  },
  {
    id: 'trends',
    href: '/dashboard/trends',
    sidebarIcon: 'trending_up',
    mobileIcon: 'trending_up',
    proOnly: true,
    hiddenFromNav: true,
  },
  {
    id: 'debts',
    href: '/dashboard/debts',
    sidebarIcon: 'description',
    mobileIcon: 'account_balance',
  },
  {
    id: 'profile',
    href: '/dashboard/profile',
    sidebarIcon: 'person',
    mobileIcon: 'person',
    // Opened from the avatar button in the header / sidebar footer instead of
    // taking a slot in the navigation bars.
    hiddenFromNav: true,
  },
];

const NAVIGATION_LABEL_KEYS: Record<DashboardScreenId, keyof Messages['navigation']> = {
  overview: 'overview',
  fixed: 'fixedBills',
  variable: 'variableExpenses',
  courses: 'courses',
  savings: 'savings',
  trends: 'trends',
  debts: 'debts',
  profile: 'profile',
};

const NAVIGATION_TITLE_KEYS: Record<DashboardScreenId, keyof Messages['navigation']> = {
  overview: 'dashboardOverview',
  fixed: 'fixedBills',
  variable: 'variableExpenses',
  courses: 'courseSession',
  savings: 'savingsGoals',
  trends: 'trendsAnalytics',
  debts: 'debtsCredits',
  profile: 'profileAccount',
};

export function getLocalizedNavLabel(item: DashboardNavItem, messages: Messages): string {
  return messages.navigation[NAVIGATION_LABEL_KEYS[item.id]];
}

export function getLocalizedNavTitle(item: DashboardNavItem, messages: Messages): string {
  return messages.navigation[NAVIGATION_TITLE_KEYS[item.id]];
}

/** Resolve the active screen id from the current pathname. */
export function getScreenIdFromPath(pathname: string | null): DashboardScreenId {
  if (!pathname) return 'overview';
  // Nested settings pages (/dashboard/profile/preferences, …) must stay on
  // the profile screen so the main nav does not fall back to Overview.
  if (pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/profile/')) {
    return 'profile';
  }
  const match = DASHBOARD_NAV_ITEMS.find(
    (item) =>
      item.href === pathname ||
      // Deeper routes (e.g. '/dashboard/fixed/details') belong to their
      // screen too — but '/dashboard' itself must not swallow every subpath.
      (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)),
  );
  // '/dashboard' (exact) and unknown subpaths fall back to overview
  return match?.id ?? 'overview';
}

/** Ordered list of screens visible to the current user. */
export function getVisibleNavItems(isPro: boolean): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter(
    (item) => !item.hiddenFromNav && (!item.proOnly || isPro),
  );
}

/**
 * Profile subpages promoted into the desktop sidebar.
 *
 * The mobile bottom nav keeps its five destinations; the desktop sidebar has
 * room for the settings pages too, grouped separately from the budget screens
 * so the two never look like one flat list.
 */
export interface ProfileSubpageNavItem {
  id: string;
  href: string;
  icon: string;
  labelKey: keyof Messages['profile']['links'];
  /** Only shown to Pro users, or to anyone already inside a household. */
  proOrHouseholdOnly?: boolean;
}

export const PROFILE_SUBPAGE_NAV_ITEMS: ProfileSubpageNavItem[] = [
  { id: 'preferences', href: '/dashboard/profile/preferences', icon: 'tune', labelKey: 'preferences' },
  { id: 'money-sources', href: '/dashboard/profile/money-sources', icon: 'account_balance_wallet', labelKey: 'moneySources' },
  { id: 'household', href: '/dashboard/profile/household', icon: 'family_restroom', labelKey: 'household', proOrHouseholdOnly: true },
  { id: 'data', href: '/dashboard/profile/data', icon: 'database', labelKey: 'data' },
  { id: 'account', href: '/dashboard/profile/account', icon: 'manage_accounts', labelKey: 'account' },
];

/**
 * Sidebar account-group items for the current user. Household management is a
 * Pro feature, so it disappears for a free user in their personal workspace —
 * a household member who is not Pro themselves still gets it, because their
 * access comes from the household rather than a subscription.
 */
export function getProfileSubpageNavItems(canManageHousehold: boolean): ProfileSubpageNavItem[] {
  return PROFILE_SUBPAGE_NAV_ITEMS.filter(
    (item) => !item.proOrHouseholdOnly || canManageHousehold,
  );
}

const PROFILE_PAGE_TITLE_KEYS: Record<string, keyof Messages['navigation']> = {
  '/dashboard/profile': 'profileAccount',
  '/dashboard/profile/preferences': 'preferences',
  '/dashboard/profile/money-sources': 'moneySources',
  '/dashboard/profile/workspace': 'workspace',
  '/dashboard/profile/pro': 'pro',
  '/dashboard/profile/data': 'data',
  '/dashboard/profile/account': 'account',
};

export function getLocalizedProfilePageTitle(pathname: string | null, messages: Messages): string | null {
  if (!pathname) return null;
  const key = PROFILE_PAGE_TITLE_KEYS[pathname];
  if (key) return messages.navigation[key];
  if (pathname.startsWith('/dashboard/profile/')) return messages.navigation.profileAccount;
  return null;
}

/**
 * Legacy compatibility helper. Dashboard UI always calls the localized helper
 * above with the active dictionary; this preserves the prior API for callers
 * that explicitly need the canonical English title.
 */
export function getProfilePageTitle(pathname: string | null): string | null {
  return getLocalizedProfilePageTitle(pathname, EN_MESSAGES);
}

/**
 * Every route the dashboard can navigate to (main screens + profile
 * subpages). Used for client-side prefetching so clicks are instant.
 */
export const DASHBOARD_NAV_HREFS: string[] = [
  ...DASHBOARD_NAV_ITEMS.map((item) => item.href),
  ...Object.keys(PROFILE_PAGE_TITLE_KEYS).filter((href) => href !== '/dashboard/profile'),
];
