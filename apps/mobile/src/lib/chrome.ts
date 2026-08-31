/** Shared floating chrome — keep FAB above the Instagram-style pill. */

export const TAB_BAR_HEIGHT = 56;
export const TAB_BAR_GAP = 8;

export function tabBarBottom(insetsBottom: number) {
  return Math.max(insetsBottom, 8) + TAB_BAR_GAP;
}

/** ~16px above the pill so the + does not cover “View all” / nav. */
export function fabBottom(insetsBottom: number) {
  return tabBarBottom(insetsBottom) + TAB_BAR_HEIGHT + 16;
}
