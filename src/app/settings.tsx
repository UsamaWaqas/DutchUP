import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';
import { LANGUAGES, useI18n } from '@/lib/i18n';
import { ThemeMode, useThemeMode } from '@/lib/theme-context';
import { Chip, ChipRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { BottomSheet, Card, Screen, SectionLabel, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

const MODES: { key: ThemeMode; label: (t: (k: string) => string) => string }[] = [
  { key: 'system', label: (t) => t('settings.system') },
  { key: 'light', label: (t) => t('settings.light') },
  { key: 'dark', label: (t) => t('settings.dark') },
];

/** App-wide preferences: appearance (light/dark/system) and language. */
export default function Settings() {
  const router = useRouter();
  const { mode, setMode } = useThemeMode();
  const { language, setLanguage, t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <Screen
      bottomPad={20}
      overlay={
        <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title={t('settings.language')}>
          <Card style={{ marginHorizontal: 20 }}>
            {LANGUAGES.map((l, i) => (
              <Pressable
                key={l.code}
                accessibilityRole="button"
                accessibilityLabel={l.label}
                onPress={() => {
                  setLanguage(l.code);
                  setPickerOpen(false);
                }}
                style={[{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, i > 0 ? rowDivider : null]}
              >
                <T size={15} w={language === l.code ? 'bold' : 'medium'}>
                  {l.label}
                </T>
                {language === l.code ? <Icon name="check" size={18} color={colors.green} strokeWidth={2.4} /> : null}
              </Pressable>
            ))}
          </Card>
        </BottomSheet>
      }
    >
      <TopBar title={t('settings.title')} label={t('common.back')} onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <SectionLabel label={t('settings.appearance')} />
        <ChipRow>
          {MODES.map((m) => (
            <Chip key={m.key} label={m.label(t)} selected={mode === m.key} onPress={() => setMode(m.key)} />
          ))}
        </ChipRow>

        <SectionLabel label={t('settings.language')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.language')}
          onPress={() => setPickerOpen(true)}
          style={{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.leather, borderWidth: 1, borderColor: 'rgba(58,28,10,0.28)', borderRadius: 14 }}
        >
          <T size={15} w="semibold">
            {current.label}
          </T>
          <Icon name="chevron-down" size={18} color={colors.muted} strokeWidth={2} />
        </Pressable>
      </View>
    </Screen>
  );
}
