import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TOP_INSET } from '@/theme';
import { Button, Field, IconButton } from '@/components/Controls';
import { T } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';

/** Create account — same Delft-navy treatment as Welcome. */
export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onCreate = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Fill in your name, email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
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
        <IconButton icon="chevron-left" label="Back" color={colors.ivory} onPress={() => router.back()} />

        {done ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
            <T serif size={34} color={colors.ivory}>
              Check your email
            </T>
            <T size={15} lh={1.55} color={colors.onDeep}>
              We sent a confirmation link to {email}. Verify it, then log in.
            </T>
            <Button label="Back to log in" kind="ivory" onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <>
            <View style={{ marginTop: 24 }}>
              <T serif size={44} lh={1} ls={-0.02} color={colors.ivory} accessibilityRole="header">
                Create an account
              </T>
            </View>
            <T size={15} lh={1.55} color={colors.onDeep} style={{ marginTop: 12 }}>
              Track shared expenses with friends, roommates and trips.
            </T>

            <View style={{ marginTop: 28, gap: 14 }}>
              <Field dark label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" placeholder="Ayesha Khan" />
              <Field dark label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
              <Field dark label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password-new" placeholder="At least 6 characters" />
              <Field dark label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="password-new" placeholder="Re-enter password" />
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
                <Button label="Create account" kind="ivory" onPress={onCreate} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
