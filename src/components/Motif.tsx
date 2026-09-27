import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ImageStyle, PixelRatio, StyleProp, ViewStyle } from 'react-native';
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
 * Every distinct (size, anchor, color, ...) configuration is drawn as a vector once, then
 * cached here as a PNG data URL and reused as a plain <Image> from then on — including by
 * every other Motif instance that happens to share the same configuration. This is what
 * keeps repeated/scrolled instances cheap: an Image is a single composited bitmap, not
 * ~350 SVG shapes re-rasterized on every frame (which is what made scrolling janky).
 */
const rasterCache = new Map<string, string>();

/**
 * The "Delft tile" pattern: a centre ring + dot, and four corner arcs that join neighbouring
 * cells into full circles. Drawn as explicit shapes (no <Pattern>) and faded away from an anchor.
 */
export function Motif({ width, height, anchor = 'tr', base = 0.3, color = colors.motif, cell = 52, stroke = 1, pos = 'tr', style }: MotifProps) {
  const w = Math.round(width);
  const h = Math.round(height);
  const cacheKey = `${w}x${h}:${anchor}:${base}:${color}:${cell}:${stroke}`;
  const [uri, setUri] = useState<string | undefined>(() => rasterCache.get(cacheKey));
  const svgRef = useRef<React.ElementRef<typeof Svg>>(null);

  const cells = useMemo(() => {
    const s = cell / 52;
    const [ax, ay] = anchor === 'tr' ? [w, 0] : anchor === 'br' ? [w, h] : [w / 2, h / 2];
    const maxd = Math.hypot(w, h) * (anchor === 'center' ? 0.62 : 0.85);
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
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
  }, [w, h, anchor, base, cell]);

  useEffect(() => {
    if (uri || w <= 0 || h <= 0) return;
    const scale = PixelRatio.get();
    const id = requestAnimationFrame(() => {
      svgRef.current?.toDataURL(
        (base64) => {
          const dataUri = `data:image/png;base64,${base64}`;
          rasterCache.set(cacheKey, dataUri);
          setUri(dataUri);
        },
        { width: Math.round(w * scale), height: Math.round(h * scale) },
      );
    });
    return () => cancelAnimationFrame(id);
  }, [cacheKey, uri, w, h]);

  const posStyle = pos === 'tr' ? { right: 0 } : { left: 0 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ position: 'absolute', top: 0, width: w, height: h, pointerEvents: 'none' }, posStyle, style] as StyleProp<ImageStyle>}
        resizeMode="stretch"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  const sw = stroke / cells.s;
  return (
    <Svg
      ref={svgRef}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', top: 0 }, posStyle, style]}
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
