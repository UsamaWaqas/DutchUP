import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, TOP_INSET } from '@/theme';
import { symbolFor } from '@/lib/currencies';
import { Icon } from './Icon';
import { IconName } from './iconData';
import { IconButton } from './Controls';
import { Motif } from './Motif';
import { T } from './Text';

/* ------------------------------------------------------------------ Screen */
interface ScreenProps {
  children: React.ReactNode;
  /** sticky area under the scrolling content (bottom action bars) */
  footer?: React.ReactNode;
  bg?: string;
  /** extra space under the scrolling content */
  bottomPad?: number;
  /** children that float above the scroll view (e.g. the Home FAB) */
  overlay?: React.ReactNode;
}

/** Full-height screen: reserves the design's 52 px top area, scrolls its body, pins an optional footer. */
export function Screen({ children, footer, bg = colors.bg, bottomPad = 0, overlay }: ScreenProps) {
  const insets = useSafeAreaInsets();
  // A footer already pads itself for the bottom inset — only stretch the scroll area's own
  // padding when nothing else is guarding the bottom edge.
  const scrollBottomPad = footer ? bottomPad : Math.max(insets.bottom, bottomPad);
  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: Math.max(insets.top, TOP_INSET) }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: scrollBottomPad }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
      {overlay}
    </View>
  );
}

/* ------------------------------------------------------------------ Headers */
/** Sub-screen top bar: 48 px, icon button left, centred serif title, 44 px slot right. */
export function TopBar({ title, icon = 'chevron-left', label = 'Back', onPress, right }: { title?: string; icon?: IconName; label?: string; onPress?: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ height: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton icon={icon} label={label} onPress={onPress} />
      {title ? (
        <T serif size={24} accessibilityRole="header">
          {title}
        </T>
      ) : (
        <View />
      )}
      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>{right}</View>
    </View>
  );
}

/** Large serif title row used by Home / Groups / Activity. */
export function LargeTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T serif size={40} lh={1} ls={-0.01} accessibilityRole="header">
        {title}
      </T>
      {right}
    </View>
  );
}

/* --------------------------------------------------------- Section + Card */
export function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 14, height: 2, backgroundColor: colors.orange }} />
        <T size={11.5} w="bold" upper ls={0.16} color={colors.muted} accessibilityRole="header">
          {label}
        </T>
      </View>
      {right ? (
        <T size={13} color={colors.muted}>
          {right}
        </T>
      ) : null}
    </View>
  );
}

/**
 * "Ledger Leather" card: a warm, tactile surface with a stitched inset border,
 * standing in for the shared paper ledger the app is modeled on.
 */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.leather,
          borderWidth: 1,
          borderColor: 'rgba(58,28,10,0.28)',
          borderRadius: radii.card,
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 2px rgba(255,236,215,0.6), inset 0 -1px 3px rgba(90,50,15,0.16), 0 8px 16px -8px rgba(70,40,10,0.28)',
        } as ViewStyle,
        style,
      ]}
    >
      <View pointerEvents="none" style={{ position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderRadius: Math.max(radii.card - 6, 4), borderWidth: 1, borderStyle: 'dashed', borderColor: colors.leatherThread }} />
      {children}
    </View>
  );
}

/** 1 px stitched hairline used between rows inside a Card. */
export const rowDivider = { borderTopWidth: 1, borderTopColor: colors.leatherThread, borderStyle: 'dashed' } as const;

/* -------------------------------------------------------------------- Hero */
interface HeroProps {
  children: React.ReactNode;
  /** height of the tile pattern, as authored in the design */
  motifHeight?: number;
  padX?: number;
  padTop?: number;
  padBottom?: number;
  gap?: number;
  radius?: number;
  /** pattern cell size (52 by default, 40 on the Groups summary strip) */
  cell?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Ledger Leather" hero: a flat saddle-brown cover (no gradient), with a
 * stitched inset border matching the Card treatment below it.
 */
export function Hero({ children, motifHeight = 230, padX = 22, padTop = 22, padBottom = 22, gap = 16, radius = radii.hero, cell = 52, style }: HeroProps) {
  const [w, setW] = useState(350);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          backgroundColor: colors.deep,
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.25)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 26px -10px rgba(20,15,5,0.45)',
        } as ViewStyle,
        style,
      ]}
    >
      <Motif width={w} height={motifHeight} cell={cell} />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: Math.max(radius - 7, 4), borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(246,243,234,0.28)' }}
      />
      <View style={{ paddingHorizontal: padX, paddingTop: padTop, paddingBottom: padBottom, gap }}>{children}</View>
    </View>
  );
}

export function Eyebrow({ children, color = colors.orange }: { children: string; color?: string }) {
  return (
    <T size={11.5} w="bold" upper ls={0.16} color={color}>
      {children}
    </T>
  );
}

/** Currency symbol prefix + big serif number, baseline aligned. */
export function MoneyBig({
  value,
  currency = 'PKR',
  size = 56,
  rsSize = 24,
  color = colors.ivory,
  rsColor = colors.onDeep,
}: {
  value: number;
  currency?: string;
  size?: number;
  rsSize?: number;
  color?: string;
  rsColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <T serif size={rsSize} color={rsColor}>
        {symbolFor(currency)}
      </T>
      <T serif size={size} lh={1} color={color} ls={-0.01} num accessibilityLabel={`${currency} ${value}`}>
        {value.toLocaleString('en-US')}
      </T>
    </View>
  );
}

/* -------------------------------------------------------------------- Tile */
export function Tile({ icon, size = 44, dark, onDeep = false }: { icon: IconName; size?: number; dark?: boolean; onDeep?: boolean }) {
  const isDark = dark ?? size >= 56;
  const r = Math.round(size * 0.3);
  const base: ViewStyle = { width: size, height: size, borderRadius: r, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' };
  let look: ViewStyle = { backgroundColor: colors.tile };
  let fg: string = colors.tileFg;
  if (onDeep) {
    look = { backgroundColor: 'rgba(246,243,234,0.10)', borderWidth: 1, borderColor: 'rgba(246,243,234,0.28)' };
    fg = colors.ivory;
  } else if (isDark) {
    look = { backgroundColor: colors.deep };
    fg = colors.ivory;
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[base, look]}>
      {isDark && !onDeep ? <Motif width={size} height={size} anchor="center" base={0.55} cell={28} pos="tl" /> : null}
      <Icon name={icon} size={Math.round(size * 0.44)} color={fg} />
    </View>
  );
}

/* ----------------------------------------------------------------- Tab bar */
const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'groups', label: 'Groups', icon: 'users' },
  { name: 'activity', label: 'Activity', icon: 'bell' },
];

interface TabBarLikeProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/** Custom bottom tab bar (white, hairline top border, orange marker on the active tab). */
export function TabBar({ state, navigation }: TabBarLikeProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 11, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 24) }}
    >
      {TABS.map((t) => {
        const on = t.name === activeName;
        const fg = on ? colors.deep : colors.muted;
        return (
          <Pressable
            key={t.name}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => navigation.navigate(t.name)}
            style={{ flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            {on ? <View style={{ position: 'absolute', top: -11, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.orange }} /> : null}
            <Icon name={t.icon} size={22} color={fg} strokeWidth={on ? 1.8 : 1.5} />
            <T size={11.5} w={on ? 'bold' : 'medium'} color={fg} ls={0.04}>
              {t.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
