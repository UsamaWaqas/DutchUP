import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TOP_INSET } from '@/theme';
import { Button, Field, IconButton } from '@/components/Controls';
import { T } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';

/** Forgot password — sends a Supabase reset-password email. */
export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPasswordForEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSend = async () => {
    if (!email.trim()) {
      setError('Enter your account email.');
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await resetPasswordForEmail(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.deep }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, TOP_INSET) - 44, paddingHorizontal: 26, paddingBottom: Math.max(insets.bottom, 32) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <IconButton icon="chevron-left" label="Back" color={colors.ivory} onPress={() => router.back()} />

        {sent ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
            <T serif size={34} color={colors.ivory}>
              Check your email
            </T>
            <T size={15} lh={1.55} color={colors.onDeep}>
              If an account exists for {email}, a reset link has been sent.
            </T>
            <Button label="Back to log in" kind="ivory" onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <>
            <View style={{ marginTop: 24 }}>
              <T serif size={44} lh={1} ls={-0.02} color={colors.ivory} accessibilityRole="header">
                Reset password
              </T>
            </View>
            <T size={15} lh={1.55} color={colors.onDeep} style={{ marginTop: 12 }}>
              Enter your email and we'll send you a link to reset your password.
            </T>

            <View style={{ marginTop: 28, gap: 14 }}>
              <Field dark label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
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
                <Button label="Send reset link" kind="ivory" onPress={onSend} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
