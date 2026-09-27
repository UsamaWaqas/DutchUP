import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@/theme';
import { rs } from '@/lib/format';
import { fetchGroups, GroupSummary } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { AvatarStack } from '@/components/Avatar';
import { SearchField, Tabs } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Eyebrow, Hero, LargeTitle, MoneyBig, Screen, Tile } from '@/components/Layout';
import { T } from '@/components/Text';

type Filter = 'Active' | 'Settled';

/** 3 · Groups — summary strip + group cards. */
export default function Groups() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('Active');
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let mounted = true;
      setLoadError(false);
      fetchGroups(user.id, profile?.default_currency ?? 'PKR')
        .then((rows) => {
          if (mounted) setGroups(rows);
        })
        .catch((err) => {
          console.error('fetchGroups failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, profile]),
  );

  if (loadError) {
    return (
      <Screen bottomPad={16}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
          <T size={14} color={colors.muted}>
            {t('groups.couldntLoadGroups')}
          </T>
        </View>
      </Screen>
    );
  }

  if (!groups) {
    return (
      <Screen bottomPad={16}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
          <ActivityIndicator color={colors.deep} />
        </View>
      </Screen>
    );
  }

  const active = groups.filter((g) => g.status !== 'settled');
  const settled = groups.filter((g) => g.status === 'settled');
  const needle = query.trim().toLowerCase();
  const list = (filter === 'Active' ? active : settled).filter((g) => !needle || g.name.toLowerCase().includes(needle));
  const overall = active.reduce((sum, g) => sum + (g.status === 'owed' ? g.amount : -g.amount), 0);

  return (
    <Screen bottomPad={16}>
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <LargeTitle
          title={t('groups.title')}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('groups.newGroup')}
              onPress={() => router.push('/new-group')}
              style={{ height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 12, backgroundColor: colors.leather, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Icon name="plus" size={17} color={colors.orange} strokeWidth={2.4} />
              <T size={14} w="bold" color={colors.ink}>
                {t('groups.newGroup')}
              </T>
            </Pressable>
          }
        />

        <SearchField placeholder={t('groups.searchGroups')} value={query} onChangeText={setQuery} />

        <Hero motifHeight={70} cell={40} padX={18} padTop={14} padBottom={14} radius={16} gap={0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 2 }}>
              <Eyebrow>{t('groups.acrossActiveGroups', { count: active.length })}</Eyebrow>
              <T size={13} color={colors.onDeep}>
                {overall >= 0 ? t('groups.youreOwedOverall') : t('groups.youOweOverall')}
              </T>
            </View>
            <MoneyBig value={Math.abs(overall)} currency={profile?.default_currency ?? 'PKR'} size={34} rsSize={16} />
          </View>
        </Hero>

        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          items={[
            { label: 'Active', display: t('groups.active'), count: active.length },
            { label: 'Settled', display: t('groups.settled'), count: settled.length },
          ]}
        />

        {list.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 6 }}>
            <T size={14} color={colors.muted}>
              {needle ? t('groups.noGroupsMatch', { query: query.trim() }) : filter === 'Active' ? t('groups.noGroupsYet') : t('groups.nothingSettledYet')}
            </T>
            {filter === 'Active' && !needle ? (
              <T size={13} color={colors.cobalt} w="bold">
                {t('groups.createFirstGroup')}
              </T>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {list.map((g) => {
              const color = g.status === 'owed' ? colors.green : g.status === 'owe' ? colors.red : colors.muted;
              return (
                <Card key={g.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={g.name}
                    onPress={() => router.push({ pathname: '/group', params: { id: g.id } })}
                    style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                  >
                    <Tile icon={g.icon} size={56} dark />
                    <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                      <T size={16} w="bold">
                        {g.name}
                      </T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AvatarStack people={g.members.slice(0, 4)} size={26} more={g.members.length > 4 ? g.members.length - 4 : undefined} />
                        <T size={12.5} color={colors.muted}>
                          {String(g.members.length)}
                        </T>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T size={12} color={colors.muted}>
                        {g.status === 'owed' ? t('groups.youreOwedRow') : g.status === 'owe' ? t('groups.youOweRow') : t('groups.allClear')}
                      </T>
                      <T size={15} w="bold" color={color} num>
                        {g.status === 'settled' ? t('groups.settledLabel') : rs(g.amount, g.currency)}
                      </T>
                    </View>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}
