export type DashboardScreenId =
  | 'overview'
  | 'fixed'
  | 'variable'
  | 'savings'
  | 'trends'
  | 'debts';

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
  },
  {
    id: 'debts',
    label: 'Debts',
    title: 'Debts & Credits',
    href: '/dashboard/debts',
    sidebarIcon: 'description',
    mobileIcon: 'account_balance',
  },
];

/** Resolve the active screen id from the current pathname. */
export function getScreenIdFromPath(pathname: string | null): DashboardScreenId {
  if (!pathname) return 'overview';
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
  return DASHBOARD_NAV_ITEMS.filter((item) => !item.proOnly || isPro);
}
