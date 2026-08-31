import React, { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Home, Receipt, ShoppingCart, PiggyBank, Landmark } from 'lucide-react-native';
import { navCompact, NAV_COMPACT_SPRING } from '../lib/nav-compact';
import { tabBarBottom } from '../lib/chrome';

type FloatingTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

const VISIBLE = ['index', 'fixed', 'transactions', 'savings', 'debts'] as const;

const ICONS: Record<string, typeof Home> = {
  index: Home,
  fixed: Receipt,
  transactions: ShoppingCart,
  savings: PiggyBank,
  debts: Landmark,
};

const SPRING = { damping: 22, stiffness: 280, mass: 0.85 };
const TEAL = '#026462';

export function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const routes = state.routes.filter((r) => VISIBLE.includes(r.name as (typeof VISIBLE)[number]));
  const activeName = state.routes[state.index]?.name;
  const activeIndex = routes.findIndex((r) => r.name === activeName);
  const pillIndex = activeIndex >= 0 ? activeIndex : 0;
  const [barWidth, setBarWidth] = useState(Math.min(screenW - 28, 420));
  const innerW = Math.max(0, barWidth - 12);
  const itemW = routes.length ? innerW / routes.length : 0;
  const pillX = useSharedValue(pillIndex * itemW);

  useEffect(() => {
    pillX.value = withSpring(pillIndex * itemW, SPRING);
    navCompact.value = withSpring(0, NAV_COMPACT_SPRING);
  }, [activeName, pillIndex, itemW, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: Math.max(itemW, 0),
  }));

  const compactStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(navCompact.value, [0, 1], [0, 8]) },
      { scale: interpolate(navCompact.value, [0, 1], [1, 0.88]) },
    ],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: tabBarBottom(insets.bottom),
        alignItems: 'center',
      }}
    >
      <Animated.View style={compactStyle}>
      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        className="flex-row items-center rounded-full border border-neutral-200/80 bg-white/90 px-1.5 py-1"
        style={{
          width: Math.min(screenW - 28, 420),
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
        }}
      >
        {activeIndex >= 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: 6,
                borderRadius: 999,
                backgroundColor: TEAL,
              },
              pillStyle,
            ]}
          />
        ) : null}
        {routes.map((route, index) => {
          const focused = index === activeIndex;
          const Icon = ICONS[route.name] || Home;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              className="flex-1 items-center justify-center py-3"
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <Icon color={focused ? '#ffffff' : '#6B7280'} size={22} strokeWidth={focused ? 2.4 : 2} />
            </Pressable>
          );
        })}
      </View>
      </Animated.View>
    </View>
  );
}
