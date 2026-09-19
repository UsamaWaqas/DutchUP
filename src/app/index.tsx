import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, View, useWindowDimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TOP_INSET } from '@/theme';
import { Button, Field } from '@/components/Controls';
import { Logo } from '@/components/Logo';
import { Motif } from '@/components/Motif';
import { T } from '@/components/Text';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured } from '@/lib/supabase';

/** 1 · Welcome / log in — the full-bleed Delft-navy entry screen. */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogIn = async () => {
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
    else router.replace('/(tabs)/home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.deep, overflow: 'hidden' }}>
      <StatusBar style="light" />
      <Motif width={Math.min(width, 480)} height={560} base={0.42} color={colors.motifWelcome} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, TOP_INSET), paddingHorizontal: 26, paddingBottom: Math.max(insets.bottom, 32) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo size={30} />
          <T serif size={28} color={colors.ivory}>
            DutchUp
          </T>
        </View>

        <View style={{ marginTop: 40 }}>
          <T serif size={54} lh={0.98} ls={-0.02} color={colors.ivory} accessibilityRole="header">
            Who owes what,
          </T>
          <T serif italic size={54} lh={0.98} ls={-0.02} color={colors.cobaltLight}>
            at a glance.
          </T>
        </View>
        <T size={15} lh={1.55} color={colors.onDeep} style={{ marginTop: 16, maxWidth: 290 }}>
          Add an expense in seconds. No daily limits, no ads, no countdown timers.
        </T>

        {!isSupabaseConfigured ? (
          <View style={{ marginTop: 20, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,122,61,0.14)', borderWidth: 1, borderColor: 'rgba(255,122,61,0.4)' }}>
            <T size={12.5} lh={1.4} color={colors.ivory}>
              Backend isn't connected yet — sign in will fail until EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env.
            </T>
          </View>
        ) : null}

        <View style={{ marginTop: 32, gap: 14 }}>
          <Field dark label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
          <Field dark label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Password" />
        </View>

        {error ? (
          <T size={13} color={colors.coral} style={{ marginTop: 10 }}>
            {error}
          </T>
        ) : null}

        <View style={{ alignItems: 'flex-end' }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} style={{ height: 44, justifyContent: 'center' }}>
            <T size={14} w="semibold" color={colors.cobaltLight}>
              Forgot password?
            </T>
          </Pressable>
        </View>

        {busy ? (
          <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.ivory} />
          </View>
        ) : (
          <Button label="Log in" kind="ivory" onPress={onLogIn} />
        )}

        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.hairDeep }} />
          <T size={12} upper ls={0.12} color={colors.onDeep}>
            or
          </T>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.hairDeep }} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          onPress={() => setError('Google sign-in needs an OAuth client set up first — coming soon.')}
          style={{ height: 54, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(246,243,234,0.5)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.ivory, alignItems: 'center', justifyContent: 'center' }}>
            <T size={12} w="bold" color={colors.ivory} lh={1}>
              G
            </T>
          </View>
          <T size={15} w="bold" color={colors.ivory}>
            Continue with Google
          </T>
        </Pressable>

        <View style={{ flexGrow: 1, minHeight: 20 }} />
        <View style={{ alignItems: 'center' }}>
          <T size={14} color={colors.onDeep}>
            New here?{' '}
            <T size={14} w="bold" color={colors.cobaltLight} onPress={() => router.push('/signup')} accessibilityRole="link">
              Create an account
            </T>
          </T>
        </View>
      </ScrollView>
    </View>
  );
}
