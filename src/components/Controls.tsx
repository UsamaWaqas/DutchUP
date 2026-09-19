import React from 'react';
import { Modal, Platform, Pressable, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme';
import { Icon } from './Icon';
import { IconName } from './iconData';
import { T } from './Text';

/* ------------------------------------------------------------------ Button */
export type ButtonKind = 'primary' | 'ivory' | 'outline' | 'outline-dark' | 'ghost';

interface ButtonProps {
  label: string;
  kind?: ButtonKind;
  icon?: IconName;
  onPress?: () => void;
  /** flex-grow with zero basis, for side-by-side buttons */
  grow?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const BUTTON_LOOK: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.leather, fg: colors.ink },
  ivory: { bg: colors.ivory, fg: colors.deep },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.ctrl },
  'outline-dark': { bg: 'transparent', fg: colors.ivory, border: 'rgba(246,243,234,0.5)' },
  ghost: { bg: 'transparent', fg: colors.cobalt },
};

export function Button({ label, kind = 'primary', icon, onPress, grow, height = 54, style }: ButtonProps) {
  const look = BUTTON_LOOK[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: 20,
          borderRadius: radii.button,
          backgroundColor: look.bg,
          borderWidth: look.border ? 1 : 0,
          borderColor: look.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        },
        grow ? { flexGrow: grow, flexBasis: 0 } : null,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={19} strokeWidth={1.8} color={look.fg} /> : null}
      <T size={15} w="bold" color={look.fg} ls={0.01}>
        {label}
      </T>
    </Pressable>
  );
}

/* -------------------------------------------------------------- IconButton */
export function IconButton({ icon, label, onPress, color = colors.ink }: { icon: IconName; label: string; onPress?: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={0}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={23} color={color} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Chip */
export function Chip({ label, icon, selected = false, onPress }: { label: string; icon?: IconName; selected?: boolean; onPress?: () => void }) {
  const fg = selected ? colors.ivory : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 44,
        paddingHorizontal: 14,
        borderRadius: radii.chip,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: selected ? colors.deep : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.deep : colors.ctrl,
      }}
    >
      {icon ? <Icon name={icon} size={17} color={fg} /> : null}
      <T size={14} w="semibold" color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

/** Wrapping chip row (never overflows the screen). */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

/* -------------------------------------------------------------------- Tabs */
export function Tabs<L extends string>({ items, active, onChange }: { items: { label: L; count?: number }[]; active: L; onChange?: (l: L) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      {items.map((it) => {
        const on = it.label === active;
        return (
          <Pressable
            key={it.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange?.(it.label)}
            style={{ height: 44, marginBottom: -1, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: on ? colors.deep : 'transparent' }}
          >
            <T size={14} w={on ? 'bold' : 'semibold'} color={on ? colors.ink : colors.muted}>
              {it.label}
            </T>
            {it.count != null ? (
              <T size={12} w="bold" color={colors.muted} style={{ marginLeft: 6 }}>
                {String(it.count)}
              </T>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- Segmented */
export function Segmented<L extends string>({ items, active, onChange }: { items: L[]; active: L; onChange?: (l: L) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.track, borderRadius: 13 }}>
      {items.map((l) => {
        const on = l === active;
        return (
          <Pressable
            key={l}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange?.(l)}
            style={{ flex: 1, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.deep : 'transparent' }}
          >
            <T size={14} w="bold" color={on ? colors.ivory : colors.muted}>
              {l}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- Field */
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  dark?: boolean;
}

export function Field({ label, dark = false, ...input }: FieldProps) {
  return (
    <View style={{ gap: 7 }}>
      <T size={12.5} w="semibold" color={dark ? colors.onDeep : colors.muted} ls={0.02}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={dark ? colors.onDeep : colors.muted}
        {...input}
        style={[
          {
            height: 54,
            paddingHorizontal: 16,
            borderRadius: radii.input,
            borderWidth: 1,
            borderColor: dark ? 'rgba(246,243,234,0.42)' : colors.ctrl,
            backgroundColor: dark ? 'rgba(246,243,234,0.06)' : colors.surface,
            color: dark ? colors.ivory : colors.ink,
            fontFamily: 'Manrope_500Medium',
            fontSize: 15.5,
          },
          noOutline,
        ]}
      />
    </View>
  );
}

interface SearchFieldProps {
  placeholder: string;
  height?: number;
  value?: string;
  onChangeText?: (v: string) => void;
  onSubmitEditing?: () => void;
  icon?: IconName;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
}

/** Search-style field: icon + borderless input inside a bordered pill (Groups, New group). */
export function SearchField({ placeholder, height = 50, value, onChangeText, onSubmitEditing, icon = 'search', keyboardType, autoCapitalize = 'none' }: SearchFieldProps) {
  return (
    <View
      style={{
        height,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: radii.input,
        borderWidth: 1,
        borderColor: colors.ctrl,
        backgroundColor: colors.surface,
      }}
    >
      <Icon name={icon} size={19} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={onSubmitEditing ? 'done' : undefined}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[{ flex: 1, minWidth: 0, height: height - 4, padding: 0, fontFamily: 'Manrope_500Medium', fontSize: 15, color: colors.ink }, noOutline]}
      />
    </View>
  );
}

/* --------------------------------------------------------------- ActionSheet */
export interface ActionSheetItem {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

/** Bottom action sheet, styled to match the design (replaces native Alert.alert). */
export function ActionSheet({ visible, onClose, title, items }: { visible: boolean; onClose: () => void; title?: string; items: ActionSheetItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,20,36,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.card,
            borderTopRightRadius: radii.card,
            paddingBottom: Math.max(insets.bottom, 16),
            overflow: 'hidden',
          }}
        >
          {title ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
              <T size={12.5} w="semibold" upper ls={0.02} color={colors.muted}>
                {title}
              </T>
            </View>
          ) : (
            <View style={{ height: 8 }} />
          )}
          {items.map((it, i) => (
            <Pressable
              key={it.label}
              accessibilityRole="button"
              accessibilityLabel={it.label}
              onPress={() => {
                onClose();
                it.onPress();
              }}
              style={({ pressed }) => [
                { height: 54, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.bg : 'transparent' },
                i > 0 ? rowDividerLocal : null,
              ]}
            >
              {it.icon ? <Icon name={it.icon} size={19} color={it.destructive ? colors.red : colors.ink} /> : null}
              <T size={15} w="medium" color={it.destructive ? colors.red : colors.ink}>
                {it.label}
              </T>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const rowDividerLocal = { borderTopWidth: 1, borderTopColor: colors.line } as const;

/* ---------------------------------------------------------------- Checkbox */
export function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange?: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange?.(!checked)}
      hitSlop={11}
      style={{
        width: 22,
        height: 22,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: checked ? colors.deep : colors.surface,
        borderWidth: checked ? 0 : 1.5,
        borderColor: colors.ctrl,
      }}
    >
      {checked ? <Icon name="check" size={15} color={colors.surface} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}
