import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@/theme';
import { rs } from '@/lib/format';
import { fetchHomeSummary, HomeSummary } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Avatar } from '@/components/Avatar';
import { ActionSheet, IconButton, Tabs } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Eyebrow, Hero, LargeTitle, MoneyBig, Screen, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

type Filter = 'All' | 'You owe' | 'Owed to you';

/** 2 · Home — net balance hero + friends list + floating "Add expense". */
export default function Home() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('All');
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let mounted = true;
      setLoadError(false);
      fetchHomeSummary(user.id, profile?.default_currency ?? 'PKR')
        .then((s) => {
          if (mounted) setSummary(s);
        })
        .catch((err) => {
          console.error('fetchHomeSummary failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, profile]),
  );

  const friends = summary?.friends ?? [];
  const totals = summary?.totals ?? { owed: 0, owe: 0 };
  const currency = summary?.currency ?? profile?.default_currency ?? 'PKR';
  const rows = friends.filter((f) => (filter === 'All' ? true : filter === 'You owe' ? !f.owed : f.owed));

  return (
    <>
    <Screen
      bottomPad={84}
      overlay={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.addExpense')}
          onPress={() => router.push('/add-expense')}
          style={{
            position: 'absolute',
            right: 20,
            bottom: 8,
            height: 52,
            paddingLeft: 18,
            paddingRight: 22,
            borderRadius: 16,
            backgroundColor: colors.leather,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 24px rgba(74,42,20,0.32)',
          }}
        >
          <Icon name="plus" size={21} color={colors.orange} strokeWidth={2.2} />
          <T size={15} w="bold" color={colors.ink} ls={0.01}>
            {t('home.addExpense')}
          </T>
        </Pressable>
      }
    >
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <LargeTitle
          title={t('home.title')}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton icon="search" label={t('home.search')} onPress={() => router.push('/search')} />
              <IconButton icon="user-plus" label={t('home.addFriend')} onPress={() => router.push('/add-friend')} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.yourProfile')}
                onPress={() => setAccountMenuOpen(true)}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                {user ? <Avatar person={{ id: user.id, name: profile?.full_name || 'You' }} size={34} /> : null}
              </Pressable>
            </View>
          }
        />

        <Hero motifHeight={230} padTop={22} padBottom={20} gap={16}>
          <View style={{ gap: 8 }}>
            <Eyebrow>{t('home.netBalance')}</Eyebrow>
            <MoneyBig value={Math.abs(totals.owed - totals.owe)} currency={currency} size={60} rsSize={24} />
          </View>
          <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
            <View style={{ flexGrow: totals.owed || 1, flexBasis: 0, backgroundColor: colors.mint, borderRadius: 3 }} />
            <View style={{ flexGrow: totals.owe || 1, flexBasis: 0, backgroundColor: colors.coral, borderRadius: 3 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {[
              { key: 'owed', label: t('home.youreOwed'), value: totals.owed, color: colors.mint },
              { key: 'owe', label: t('home.youOwe'), value: totals.owe, color: colors.coral },
            ].map((c) => (
              <View key={c.key} style={{ flex: 1, gap: 3 }}>
                <T size={11.5} upper ls={0.1} color={colors.onDeep}>
                  {c.label}
                </T>
                <T size={19} w="bold" color={c.color} num>
                  {rs(c.value, currency)}
                </T>
              </View>
            ))}
          </View>
        </Hero>

        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          items={[
            { label: 'All', display: t('home.all'), count: friends.length },
            { label: 'You owe', display: t('home.youOwe'), count: friends.filter((f) => !f.owed).length },
            { label: 'Owed to you', display: t('home.owedToYou'), count: friends.filter((f) => f.owed).length },
          ]}
        />

        {loadError ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              {t('home.couldntLoadBalances')}
            </T>
          </View>
        ) : !summary ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.deep} />
          </View>
        ) : rows.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              {friends.length === 0 ? t('home.allSettled') : t('home.nothingHere')}
            </T>
          </View>
        ) : (
          <Card>
            {rows.map((f, i) => (
              <Pressable
                key={f.person.id}
                accessibilityRole="button"
                accessibilityLabel={`${f.person.name}, ${f.owed ? t('home.owesYou') : t('home.youOweLower')} ${rs(f.amount, currency)}`}
                onPress={f.owed ? undefined : () => router.push({ pathname: '/settle', params: { groupId: f.groupId, otherUserId: f.person.id } })}
                style={[{ minHeight: 58, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}
              >
                <Avatar person={f.person} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={15} w="semibold">
                    {f.person.name}
                  </T>
                  <T size={12.5} color={colors.muted}>
                    {f.sub}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T size={12} color={colors.muted}>
                    {f.owed ? t('home.owesYou') : t('home.youOweLower')}
                  </T>
                  <T size={15} w="bold" color={f.owed ? colors.green : colors.red} num>
                    {rs(f.amount, currency)}
                  </T>
                </View>
              </Pressable>
            ))}
          </Card>
        )}
      </View>
    </Screen>
    <ActionSheet
      visible={accountMenuOpen}
      onClose={() => setAccountMenuOpen(false)}
      title={t('account.title')}
      items={[
        { label: t('account.notificationSettings'), icon: 'bell', onPress: () => router.push('/notifications') },
        { label: t('settings.title'), icon: 'settings', onPress: () => router.push('/settings') },
        { label: t('account.signOut'), icon: 'x', destructive: true, onPress: signOut },
      ]}
    />
    </>
  );
}
