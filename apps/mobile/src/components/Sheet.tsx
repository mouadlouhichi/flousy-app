import React, { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Fade the dim overlay in place; only the sheet slides up.
 * (RN `animationType="slide"` moves the backdrop with the sheet.)
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlay = useSharedValue(0);
  const sheetY = useSharedValue(48);
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      overlay.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
      sheetY.value = withSpring(0, { damping: 26, stiffness: 380, mass: 0.7 });
    } else if (mounted) {
      overlay.value = withTiming(0, { duration: 120 });
      sheetY.value = withTiming(36, { duration: 120 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, overlay, sheetY]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, overlayStyle]}>
          <Pressable className="flex-1 bg-black/40" onPress={onClose} />
        </Animated.View>
        <Animated.View style={sheetStyle}>{children}</Animated.View>
      </View>
    </Modal>
  );
}
