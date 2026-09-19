import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme';

/** Two interlocking rings: one orange, one ivory. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={12} cy={16} r={9} fill="none" stroke={colors.orange} strokeWidth={2.2} />
      <Circle cx={20} cy={16} r={9} fill="none" stroke={colors.ivory} strokeWidth={2.2} />
    </Svg>
  );
}
