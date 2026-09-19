import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '@/theme';

interface MotifProps {
  width: number;
  height: number;
  anchor?: 'tr' | 'center' | 'br';
  /** peak opacity of the cell closest to the anchor */
  base?: number;
  color?: string;
  /** cell size in px (the tile drawing is authored on a 52 px cell) */
  cell?: number;
  stroke?: number;
  /** where the svg sits inside its (overflow:hidden) parent */
  pos?: 'tr' | 'tl';
  style?: StyleProp<ViewStyle>;
}

/**
 * The "Delft tile" pattern: a centre ring + dot, and four corner arcs that join neighbouring
 * cells into full circles. Drawn as explicit shapes (no <Pattern>) and faded away from an anchor.
 */
export function Motif({ width, height, anchor = 'tr', base = 0.3, color = colors.motif, cell = 52, stroke = 1, pos = 'tr', style }: MotifProps) {
  const cells = useMemo(() => {
    const s = cell / 52;
    const [ax, ay] = anchor === 'tr' ? [width, 0] : anchor === 'br' ? [width, height] : [width / 2, height / 2];
    const maxd = Math.hypot(width, height) * (anchor === 'center' ? 0.62 : 0.85);
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const out: { key: string; x: number; y: number; op: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const op = base * Math.max(0, 1 - Math.hypot(ax - cx, ay - cy) / maxd);
        if (op < 0.035) continue;
        out.push({ key: `${r}-${c}`, x: c * cell, y: r * cell, op: Math.round(op * 100) / 100 });
      }
    }
    return { s, out };
  }, [width, height, anchor, base, cell]);

  const sw = stroke / cells.s;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', top: 0 }, pos === 'tr' ? { right: 0 } : { left: 0 }, style]}
    >
      {cells.out.map((c) => (
        <G key={c.key} transform={`translate(${c.x} ${c.y}) scale(${cells.s})`} opacity={c.op} fill="none" stroke={color} strokeWidth={sw}>
          <Circle cx={26} cy={26} r={9} />
          <Circle cx={26} cy={26} r={2} fill={color} stroke="none" />
          <Path d="M11 0A11 11 0 0 1 0 11" />
          <Path d="M41 0A11 11 0 0 0 52 11" />
          <Path d="M0 41A11 11 0 0 1 11 52" />
          <Path d="M52 41A11 11 0 0 0 41 52" />
        </G>
      ))}
    </Svg>
  );
}
