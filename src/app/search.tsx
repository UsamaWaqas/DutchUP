import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';
import { rs } from '@/lib/format';
import { searchAll, SearchResults } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/Icon';
import { SearchField } from '@/components/Controls';
import { Card, Screen, SectionLabel, Tile, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

/** Search across your groups (by name) and expenses (by description). */
export default function Search() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q || !user) {
      // Clearing state for an emptied query, not deriving it from a prop — the debounced
      // fetch below is this effect's real job, so this stays part of the same effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setLoadError(false);
    debounce.current = setTimeout(() => {
      searchAll(user.id, q)
        .then(setResults)
        .catch((err) => {
          console.error('searchAll failed', err);
          setLoadError(true);
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, user]);

  const hasQuery = query.trim().length > 0;
  const hasResults = !!results && (results.groups.length > 0 || results.expenses.length > 0);

  return (
    <Screen bottomPad={20}>
      <TopBar title={t('search.title')} label={t('common.close')} icon="x" onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <SearchField placeholder={t('search.placeholder')} value={query} onChangeText={setQuery} autoCapitalize="none" />

        {!hasQuery ? null : loadError ? (
          <T size={14} color={colors.muted}>
            {t('search.couldntSearch')}
          </T>
        ) : searching && !results ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.deep} />
          </View>
        ) : !hasResults ? (
          <T size={14} color={colors.muted}>
            {t('search.nothingFound', { query: query.trim() })}
          </T>
        ) : (
          <>
            {results!.groups.length > 0 ? (
              <View style={{ gap: 8 }}>
                <SectionLabel label={t('groups.title')} />
                <Card>
                  {results!.groups.map((g, i) => (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/group', params: { id: g.id } })}
                      style={[{ minHeight: 58, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}
                    >
                      <Tile icon={g.icon} size={40} />
                      <T size={15} w="semibold">
                        {g.name}
                      </T>
                    </Pressable>
                  ))}
                </Card>
              </View>
            ) : null}

            {results!.expenses.length > 0 ? (
              <View style={{ gap: 8 }}>
                <SectionLabel label={t('search.expenses')} />
                <Card>
                  {results!.expenses.map((e, i) => (
                    <Pressable
                      key={e.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/expense', params: { id: e.id } })}
                      style={[{ minHeight: 58, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="bag" size={18} color={colors.tileFg} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T size={15} w="semibold">
                          {e.description}
                        </T>
                        {e.groupName ? (
                          <T size={12.5} color={colors.muted}>
                            {e.groupName}
                          </T>
                        ) : null}
                      </View>
                      <T size={14.5} w="bold" num>
                        {rs(e.amount, e.currency)}
                      </T>
                    </Pressable>
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
