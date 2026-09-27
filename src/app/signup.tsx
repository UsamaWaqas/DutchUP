import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TOP_INSET } from '@/theme';
import { Button, Field, IconButton } from '@/components/Controls';
import { T } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';

/** Create account — same Delft-navy treatment as Welcome. */
export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { t } = useI18n();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onCreate = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError(t('auth.fillNameEmailPassword'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMin6'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await signUp(email.trim(), password, fullName.trim());
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.deep }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, TOP_INSET) - 44, paddingHorizontal: 26, paddingBottom: Math.max(insets.bottom, 32) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <IconButton icon="chevron-left" label={t('common.back')} color={colors.ivory} onPress={() => router.back()} />

        {done ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
            <T serif size={34} color={colors.ivory}>
              {t('auth.checkYourEmail')}
            </T>
            <T size={15} lh={1.55} color={colors.onDeep}>
              {t('auth.confirmationSent', { email })}
            </T>
            <Button label={t('auth.backToLogIn')} kind="ivory" onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <>
            <View style={{ marginTop: 24 }}>
              <T serif size={44} lh={1} ls={-0.02} color={colors.ivory} accessibilityRole="header">
                {t('auth.createAccount')}
              </T>
            </View>
            <T size={15} lh={1.55} color={colors.onDeep} style={{ marginTop: 12 }}>
              {t('auth.trackSharedExpenses')}
            </T>

            <View style={{ marginTop: 28, gap: 14 }}>
              <Field dark label={t('auth.fullName')} value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" placeholder="Ayesha Khan" />
              <Field dark label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
              <Field dark label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" placeholder={t('auth.atLeast6Chars')} />
              <Field dark label={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="password-new" placeholder={t('auth.reenterPassword')} />
            </View>

            {error ? (
              <T size={13} color={colors.coral} style={{ marginTop: 12 }}>
                {error}
              </T>
            ) : null}

            <View style={{ marginTop: 24 }}>
              {busy ? (
                <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.ivory} />
                </View>
              ) : (
                <Button label={t('auth.createAccount')} kind="ivory" onPress={onCreate} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
