import React, { useRef } from 'react';
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { withSpring } from 'react-native-reanimated';
import { navCompact, NAV_COMPACT_SPRING } from '../lib/nav-compact';

export function DashboardScrollView({
  horizontal,
  onScroll,
  scrollEventThrottle,
  ...props
}: ScrollViewProps) {
  const lastY = useRef(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!horizontal) {
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastY.current;
      if (y <= 24) {
        navCompact.value = withSpring(0, NAV_COMPACT_SPRING);
      } else if (delta > 6) {
        navCompact.value = withSpring(1, NAV_COMPACT_SPRING);
      } else if (delta < -6) {
        navCompact.value = withSpring(0, NAV_COMPACT_SPRING);
      }
      lastY.current = y;
    }
    onScroll?.(e);
  };

  return (
    <ScrollView
      horizontal={horizontal}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      {...props}
    />
  );
}
