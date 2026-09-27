import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { colors } from '@/theme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider, useThemeMode } from '@/lib/theme-context';
import { LanguageProvider } from '@/lib/i18n';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { installGlobalErrorHandler } from '@/lib/globalErrorHandler';

SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();

/** Routes reachable while logged out. 'reset-password' also stays put once a recovery
 *  session lands (it manages its own redirect once the new password is saved). */
const PUBLIC_ROUTES = new Set(['signup', 'forgot-password', 'reset-password']);
/** Of the public routes, these bounce to /home once a real session exists. */
const AUTH_ONLY_ROUTES = new Set(['signup', 'forgot-password']);

function useProtectedRoute() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] as string | undefined;
    const isPublic = first === undefined || PUBLIC_ROUTES.has(first);

    if (!session && !isPublic) {
      router.replace('/');
    } else if (session && (first === undefined || AUTH_ONLY_ROUTES.has(first))) {
      router.replace('/(tabs)/home');
    }
  }, [session, loading, segments, router]);
}

function Navigation() {
  useProtectedRoute();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.deep } }} />
      <Stack.Screen name="signup" options={{ contentStyle: { backgroundColor: colors.deep } }} />
      <Stack.Screen name="forgot-password" options={{ contentStyle: { backgroundColor: colors.deep } }} />
      <Stack.Screen name="reset-password" options={{ contentStyle: { backgroundColor: colors.deep } }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="group" />
      <Stack.Screen name="expense" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settle" />
      <Stack.Screen name="search" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="new-group" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="add-friend" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="add-expense" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

function ThemedShell({ remountKey }: { remountKey: number }) {
  const { scheme } = useThemeMode();
  return (
    // Language and auth state must survive a theme toggle, so they live outside the
    // remount boundary — only the navigator (which reads the mutated `colors` object
    // directly at render time) needs to be forced to fully remount here.
    <LanguageProvider>
      <AuthProvider>
        <React.Fragment key={remountKey}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* On web the phone layout is centred at a phone-like width. */}
          <View style={[{ flex: 1, backgroundColor: colors.bg }, Platform.OS === 'web' ? { width: '100%', maxWidth: 480, alignSelf: 'center' } : null]}>
            <ErrorBoundary>
              <Navigation />
            </ErrorBoundary>
          </View>
        </React.Fragment>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>{(remountKey) => <ThemedShell remountKey={remountKey} />}</ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
