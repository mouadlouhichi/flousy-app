import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

export function AppLogo({
  size = 72,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require('../../assets/smartjib-logo.png')}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
      accessibilityLabel="SmartJib"
    />
  );
}
