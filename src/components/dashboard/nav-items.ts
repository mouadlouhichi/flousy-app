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
  /** Short label used in nav items */
  label: string;
  /** Full page title shown in the desktop header */
  title: string;
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
    label: 'Overview',
    title: 'Dashboard Overview',
    href: '/dashboard',
    sidebarIcon: 'house',
    mobileIcon: 'house',
  },
  {
    id: 'fixed',
    label: 'Fixed Bills',
    title: 'Fixed Bills',
    href: '/dashboard/fixed',
    sidebarIcon: 'event_repeat',
    mobileIcon: 'receipt',
  },
  {
    id: 'variable',
    label: 'Variable Expenses',
    title: 'Variable Expenses',
    href: '/dashboard/variable',
    sidebarIcon: 'receipt_long',
    mobileIcon: 'shopping_cart',
  },
  {
    id: 'courses',
    label: 'Courses',
    title: 'Course Session',
    href: '/dashboard/courses',
    sidebarIcon: 'scan_barcode',
    mobileIcon: 'scan_barcode',
    // Reached from the quick actions ("Start Course") rather than taking a
    // slot in the five-destination nav bars.
    hiddenFromNav: true,
  },
  {
    id: 'savings',
    label: 'Savings',
    title: 'Savings Goals',
    href: '/dashboard/savings',
    sidebarIcon: 'savings',
    mobileIcon: 'savings',
  },
  {
    id: 'trends',
    label: 'Trends',
    title: 'Trends & Analytics',
    href: '/dashboard/trends',
    sidebarIcon: 'trending_up',
    mobileIcon: 'trending_up',
    proOnly: true,
    hiddenFromNav: true,
  },
  {
    id: 'debts',
    label: 'Debts',
    title: 'Debts & Credits',
    href: '/dashboard/debts',
    sidebarIcon: 'description',
    mobileIcon: 'account_balance',
  },
  {
    id: 'profile',
    label: 'Profile',
    title: 'Profile & Account',
    href: '/dashboard/profile',
    sidebarIcon: 'person',
    mobileIcon: 'person',
    // Opened from the avatar button in the header / sidebar footer instead of
    // taking a slot in the navigation bars.
    hiddenFromNav: true,
  },
];

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

const PROFILE_PAGE_TITLES: Record<string, string> = {
  '/dashboard/profile': 'Profile & Account',
  '/dashboard/profile/preferences': 'Preferences',
  '/dashboard/profile/money-sources': 'Money Sources',
  '/dashboard/profile/workspace': 'Workspace',
  '/dashboard/profile/pro': 'Pro',
  '/dashboard/profile/data': 'Data',
  '/dashboard/profile/account': 'Account',
};

/** Desktop header title for the profile hub and its nested settings pages. */
export function getProfilePageTitle(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname in PROFILE_PAGE_TITLES) return PROFILE_PAGE_TITLES[pathname];
  if (pathname.startsWith('/dashboard/profile/')) return 'Profile & Account';
  return null;
}

/**
 * Every route the dashboard can navigate to (main screens + profile
 * subpages). Used for client-side prefetching so clicks are instant.
 */
export const DASHBOARD_NAV_HREFS: string[] = [
  ...DASHBOARD_NAV_ITEMS.map((item) => item.href),
  ...Object.keys(PROFILE_PAGE_TITLES).filter((href) => href !== '/dashboard/profile'),
];
