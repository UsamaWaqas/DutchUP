import React from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';
import { colorsFor, initialsOf, Person } from '@/lib/person';
import { T } from './Text';

interface AvatarProps {
  person: Person;
  size?: number;
  /** use the on-dark palette (avatars sitting on the navy hero) */
  dark?: boolean;
  /** single-letter initial, used inside stacks */
  one?: boolean;
}

export function Avatar({ person, size = 44, dark = false, one = false }: AvatarProps) {
  const c = colorsFor(person.id);
  const bg = dark ? c.dbg : c.bg;
  const fg = dark ? c.dfg : c.fg;
  const initials = initialsOf(person.name);
  const text = one ? initials[0] : initials;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <T size={Math.max(12, Math.round(size * 0.33))} w="bold" color={fg} ls={0.02} lh={1}>
        {text}
      </T>
    </View>
  );
}

interface StackProps {
  people: Person[];
  size?: number;
  ring?: string;
  dark?: boolean;
  more?: number;
}

/** Overlapping avatars: 18% overlap, 2px ring in the surface colour, optional "+N" bubble. */
export function AvatarStack({ people, size = 28, ring = colors.surface, dark = false, more }: StackProps) {
  const ov = Math.round(size * 0.18);
  // A plain border reproduces the same "ring" look as a 0-blur/2px-spread box-shadow,
  // without the expensive per-frame shadow rendering boxShadow causes on Android.
  const ringStyle = { borderRadius: size, borderWidth: 2, borderColor: ring } as const;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 2 }}>
      {people.map((p, i) => (
        <View key={p.id} style={[ringStyle, { marginLeft: i === 0 ? 0 : -ov }]}>
          <Avatar person={p} size={size} dark={dark} one />
        </View>
      ))}
      {more ? (
        <View
          style={[
            ringStyle,
            {
              marginLeft: -ov,
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dark ? '#5C3B1E' : colors.deep,
            },
          ]}
        >
          <T size={12} w="bold" color={colors.ivory} lh={1}>{`+${more}`}</T>
        </View>
      ) : null}
    </View>
  );
}
