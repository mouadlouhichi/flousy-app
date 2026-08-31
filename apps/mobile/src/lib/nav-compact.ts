import { makeMutable, withSpring } from 'react-native-reanimated';

/** 0 = full Instagram bar, 1 = compact (scrolled down). */
export const navCompact = makeMutable(0);

export const NAV_COMPACT_SPRING = { damping: 32, stiffness: 380, mass: 0.9 };

export function setNavCompact(compact: boolean) {
  'worklet';
  navCompact.value = withSpring(compact ? 1 : 0, NAV_COMPACT_SPRING);
}
