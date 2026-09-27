import React from 'react';
import { View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { colors } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { T } from '@/components/Text';

/** Shown for any route that doesn't match a screen (bad deep link, stale link, etc). */
export default function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
        <T size={19} w="bold">
          {t('notFound.title')}
        </T>
        <T size={14} color={colors.muted} align="center">
          {t('notFound.body')}
        </T>
        <Link href="/(tabs)/home" replace style={{ marginTop: 16 }}>
          <T size={15} w="bold" color={colors.orange}>
            {t('notFound.goHome')}
          </T>
        </Link>
      </View>
    </>
  );
}
