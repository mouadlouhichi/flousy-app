/** Shared floating chrome — FAB sits 0.5rem above the Instagram-style pill. */

export const TAB_BAR_HEIGHT = 56;
export const TAB_BAR_GAP = 8;
/** Web: 0.5rem between the add button and the nav. */
export const FAB_NAV_GAP = 8;

export function tabBarBottom(insetsBottom: number) {
  return Math.max(insetsBottom, 8) + TAB_BAR_GAP;
}

export function fabBottom(insetsBottom: number) {
  return tabBarBottom(insetsBottom) + TAB_BAR_HEIGHT + FAB_NAV_GAP;
}
