import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyColorScheme } from '@/theme';

export type ThemeMode = 'system' | 'light' | 'dark';
type Scheme = 'light' | 'dark';

const STORAGE_KEY = '@dutchup/theme-mode';

interface ThemeContextValue {
  mode: ThemeMode;
  scheme: Scheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(mode: ThemeMode): Scheme {
  if (mode === 'system') return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  return mode;
}

/**
 * Applies the color scheme by mutating the single `colors` object in `theme.ts` in place,
 * then bumps `remountKey` so every already-rendered screen re-runs its render function and
 * picks up the new values — no screen needs to import a hook to stay theme-aware.
 */
export function ThemeProvider({ children }: { children: (remountKey: number) => React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [scheme, setScheme] = useState<Scheme>(() => resolveScheme('system'));
  const [remountKey, setRemountKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const initial: ThemeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      const initialScheme = resolveScheme(initial);
      applyColorScheme(initialScheme);
      setModeState(initial);
      setScheme(initialScheme);
      setLoaded(true);
    });
  }, []);

  const applyScheme = useCallback((nextScheme: Scheme) => {
    applyColorScheme(nextScheme);
    setScheme((cur) => {
      if (cur !== nextScheme) setRemountKey((k) => k + 1);
      return nextScheme;
    });
  }, []);

  // Only matters while `mode === 'system'` — follow the OS light/dark switch live.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setModeState((currentMode) => {
        if (currentMode === 'system') applyScheme(colorScheme === 'dark' ? 'dark' : 'light');
        return currentMode;
      });
    });
    return () => sub.remove();
  }, [applyScheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      applyScheme(resolveScheme(next));
      setModeState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    },
    [applyScheme],
  );

  const value = useMemo<ThemeContextValue>(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children(remountKey)}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider');
  return ctx;
}
