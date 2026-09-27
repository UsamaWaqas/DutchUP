import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TOP_INSET } from '@/theme';
import { Button, Field } from '@/components/Controls';
import { T } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

/** Parses the recovery link Supabase opens `dutchup://reset-password` with, either as
 *  `#access_token=...&refresh_token=...&type=recovery` (implicit flow) or
 *  `?token_hash=...&type=recovery` (PKCE/OTP flow — the current Supabase default). */
async function consumeRecoveryUrl(url: string): Promise<string | null> {
  const splitAt = url.search(/[?#]/);
  const rawParams = splitAt === -1 ? '' : url.slice(splitAt + 1);
  const params = new URLSearchParams(rawParams);
  const tokenHash = params.get('token_hash');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return error ? error.message : null;
  }
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return error ? error.message : null;
  }
  return 'Reset link is missing or invalid.';
}

/** Landing screen for the password-reset email link: establishes the recovery session, then lets the user set a new password. */
export default function ResetPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, updatePassword, signOut } = useAuth();
  const { t } = useI18n();

  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    const handleUrl = async (url: string | null) => {
      if (!url) {
        if (mounted) setChecking(false);
        return;
      }
      const err = await consumeRecoveryUrl(url);
      if (mounted) {
        setLinkError(err);
        setChecking(false);
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const onSave = async () => {
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
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  };

  const onDoneContinue = async () => {
    router.replace('/(tabs)/home');
  };

  const onBackToLogin = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.deep }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, TOP_INSET), paddingHorizontal: 26, paddingBottom: Math.max(insets.bottom, 32) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {checking ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.ivory} />
          </View>
        ) : linkError || !session ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
            <T serif size={34} color={colors.ivory}>
              {t('auth.linkExpired')}
            </T>
            <T size={15} lh={1.55} color={colors.onDeep}>
              {linkError ?? t('auth.linkNoLongerValid')} {t('auth.requestNewOne')}
            </T>
            <Button label={t('auth.backToLogIn')} kind="ivory" onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
          </View>
        ) : done ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
            <T serif size={34} color={colors.ivory}>
              {t('auth.passwordUpdated')}
            </T>
            <T size={15} lh={1.55} color={colors.onDeep}>
              {t('auth.allSetContinue')}
            </T>
            <Button label={t('auth.continueLabel')} kind="ivory" onPress={onDoneContinue} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <>
            <View style={{ marginTop: 24 }}>
              <T serif size={44} lh={1} ls={-0.02} color={colors.ivory} accessibilityRole="header">
                {t('auth.setNewPassword')}
              </T>
            </View>
            <T size={15} lh={1.55} color={colors.onDeep} style={{ marginTop: 12 }}>
              {t('auth.chooseNewPassword')}
            </T>

            <View style={{ marginTop: 28, gap: 14 }}>
              <Field dark label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" placeholder={t('auth.atLeast6Chars')} />
              <Field dark label={t('auth.confirmNewPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="password-new" placeholder={t('auth.reenterPassword')} />
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
                <Button label={t('auth.savePassword')} kind="ivory" onPress={onSave} />
              )}
            </View>

            <Button label={t('common.cancel')} kind="outline-dark" onPress={onBackToLogin} style={{ marginTop: 12 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
