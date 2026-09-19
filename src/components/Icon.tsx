import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';
import { ICONS, IconName } from './iconData';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Inline stroke icon (24x24 grid), same geometry as the design. */
export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ICONS[name].map((p, i) => {
        const common = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
        if (p.t === 'path') return <Path key={i} {...common} d={p.d} />;
        if (p.t === 'circle') return <Circle key={i} {...common} cx={p.cx} cy={p.cy} r={p.r} />;
        return <Rect key={i} {...common} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} />;
      })}
    </Svg>
  );
}
