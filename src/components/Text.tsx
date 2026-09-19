import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { colors, fonts } from '@/theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TProps extends TextProps {
  size?: number;
  w?: Weight;
  color?: string;
  /** unitless line-height multiplier (CSS style). The design inherits 1.4 everywhere unless stated. */
  lh?: number;
  /** letter-spacing in em (converted to px). */
  ls?: number;
  upper?: boolean;
  serif?: boolean;
  italic?: boolean;
  /** tabular numerals for money */
  num?: boolean;
  align?: TextStyle['textAlign'];
}

/** The one text primitive: maps CSS-like props from the design onto RN text styles. */
export function T({ size = 15, w = 'regular', color = colors.ink, lh, ls, upper, serif, italic, num, align, style, ...rest }: TProps) {
  const family = serif ? (italic ? fonts.serifItalic : fonts.serif) : fonts[w];
  const line = lh ?? 1.4;
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: family,
          fontSize: size,
          lineHeight: Math.round(size * line * 100) / 100,
          color,
          letterSpacing: ls ? ls * size : undefined,
          textTransform: upper ? 'uppercase' : undefined,
          fontVariant: num ? ['tabular-nums'] : undefined,
          textAlign: align,
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}

/** Renders "plain **bold** plain" with bold runs, used by the activity feed. */
export function Rich({ text, size = 14.5, color = colors.ink }: { text: string; size?: number; color?: string }) {
  const parts = text.split('**');
  return (
    <T size={size} color={color}>
      {parts.map((p, i) => (
        <RNText key={i} style={i % 2 === 1 ? { fontFamily: fonts.bold } : undefined}>
          {p}
        </RNText>
      ))}
    </T>
  );
}
