import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { rs } from '@/lib/format';
import { categoryIcon, categoryLabel } from '@/lib/categories';
import { exportCsv } from '@/lib/csv';
import { fetchGroupDetail, fetchGroupExpensesForExport, GroupDetail, SpendingSlice } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Person } from '@/lib/person';
import { Avatar, AvatarStack } from '@/components/Avatar';
import { Button, IconButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { BottomSheet, Card, Eyebrow, Hero, MoneyBig, Screen, SectionLabel, SheetActions, Tile, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

/** Ranked single-series bars: each row is already text-labeled, so one accent colour carries every bar. */
function CategoryBars({ data, currency }: { data: SpendingSlice[]; currency: string }) {
  const { t } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <View style={{ gap: 12 }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} w="semibold">
              {categoryLabel(d.label, t)}
            </T>
            <T size={13} w="bold" color={colors.muted} num>
              {rs(d.amount, currency)}
            </T>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(4, (d.amount / max) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: colors.cobalt }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Monthly totals as vertical bars — bottom-aligned so month labels share one baseline. */
function MonthBars({ data, currency }: { data: SpendingSlice[]; currency: string }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <T size={10.5} w="bold" color={colors.muted} num>
            {d.amount > 0 ? rs(d.amount, currency) : ''}
          </T>
          <View style={{ width: '100%', height: Math.max(4, (d.amount / max) * 72), borderRadius: 4, backgroundColor: colors.cobalt }} />
          <T size={11} color={colors.muted}>
            {d.label}
          </T>
        </View>
      ))}
    </View>
  );
}

function BalanceCell({ person, amount, currency }: { person: Person; amount: number; currency: string }) {
  return (
    <View
      style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }}
    >
      <Avatar person={person} size={34} />
      <View style={{ minWidth: 0 }}>
        <T size={13.5} w="semibold">
          {person.name.split(' ')[0]}
        </T>
        <T size={14.5} w="bold" color={colors.green} num>
          {rs(amount, currency)}
        </T>
      </View>
    </View>
  );
}

/** 5 · Group detail — balances + expense ledger + sticky actions. */
export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [picking, setPicking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user || !id) return;
      let mounted = true;
      setLoadError(false);
      fetchGroupDetail(id, user.id, profile?.default_currency ?? 'PKR')
        .then((detail) => {
          if (mounted) setGroup(detail);
        })
        .catch((err) => {
          console.error('fetchGroupDetail failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, id, profile]),
  );

  if (loadError) {
    return (
      <Screen bottomPad={20}>
        <TopBar label={t('group.backToGroups')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <T size={14} color={colors.muted}>
            {t('group.couldntLoadGroup')}
          </T>
        </View>
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen bottomPad={20}>
        <TopBar label={t('group.backToGroups')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <ActivityIndicator color={colors.deep} />
        </View>
      </Screen>
    );
  }

  const otherMembers = group.members.filter((m) => m.id !== user?.id);
  const balanceOwners = group.balances.filter((b) => b.amount > 0.5);

  const goSettle = (otherUserId: string) => {
    setPicking(false);
    router.push({ pathname: '/settle', params: { groupId: group.id, otherUserId } });
  };

  const handleSettlePress = () => {
    if (otherMembers.length === 0) return; // nobody else in the group to settle with
    if (balanceOwners.length === 1) {
      goSettle(balanceOwners[0].person.id);
    } else if (otherMembers.length === 1) {
      goSettle(otherMembers[0].id);
    } else {
      setPicking(true);
    }
  };

  const exportExpenses = async () => {
    setMenuOpen(false);
    try {
      const rows = await fetchGroupExpensesForExport(group.id);
      await exportCsv(group.name, rows);
    } catch (e: any) {
      Alert.alert(t('group.couldntExport'), e?.message ?? t('common.tryAgain'));
    }
  };

  return (
    <Screen
      bottomPad={20}
      footer={
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 28), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Button label={t('settle.title')} kind="outline" grow={1} onPress={handleSettlePress} disabled={otherMembers.length === 0} />
          <Button label={t('home.addExpense')} icon="plus" grow={1.3} onPress={() => router.push({ pathname: '/add-expense', params: { groupId: group.id } })} />
        </View>
      }
      overlay={
        <>
          <BottomSheet visible={picking} onClose={() => setPicking(false)} title={t('group.settleUpWith')}>
            {otherMembers.length === 0 ? (
              <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                <T size={14} color={colors.muted}>
                  {t('group.noOtherMembers')}
                </T>
              </View>
            ) : (
              <Card style={{ marginHorizontal: 20 }}>
                {otherMembers.map((p, i) => (
                  <Pressable key={p.id} accessibilityRole="button" onPress={() => goSettle(p.id)} style={[{ minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
                    <Avatar person={p} size={36} />
                    <T size={15} w="semibold">
                      {p.name}
                    </T>
                  </Pressable>
                ))}
              </Card>
            )}
          </BottomSheet>
          <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={group.name}>
            <SheetActions
              items={[
                { label: t('group.exportExpenses'), icon: 'share', onPress: exportExpenses },
                { label: t('account.notificationSettings'), icon: 'bell', onPress: () => { setMenuOpen(false); router.push('/notifications'); } },
              ]}
            />
          </BottomSheet>
        </>
      }
    >
      <TopBar label={t('group.backToGroups')} onPress={() => router.back()} right={<IconButton icon="more" label={t('group.groupSettings')} onPress={() => setMenuOpen(true)} />} />
      <View style={{ paddingHorizontal: 20, paddingTop: 6, gap: 16 }}>
        <Hero motifHeight={230}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Tile icon={group.icon} size={56} onDeep />
            <View style={{ gap: 9 }}>
              <T serif size={36} lh={1} color={colors.ivory} accessibilityRole="header">
                {group.name}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <AvatarStack people={group.members} size={28} ring={colors.deep} dark />
                <T size={13} color={colors.onDeep}>
                  {t('group.member', { count: group.members.length })}
                </T>
              </View>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.hairDeep }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ gap: 8 }}>
              <Eyebrow color={colors.mint}>{group.myNet >= 0 ? t('home.youreOwed') : t('home.youOwe')}</Eyebrow>
              <MoneyBig value={Math.abs(group.myNet)} currency={group.currency} size={52} rsSize={22} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4, paddingBottom: 4 }}>
              <T size={11.5} upper ls={0.1} color={colors.onDeep}>
                {t('group.totalSpent')}
              </T>
              <T size={16} w="bold" color={colors.ivory} num>
                {rs(group.totalSpent, group.currency)}
              </T>
            </View>
          </View>
        </Hero>

        {group.balances.length > 0 ? (
          <>
            <SectionLabel label={t('group.balances')} right={group.balancesLabel} />
            <View style={{ gap: 8 }}>
              {[group.balances.slice(0, 2), group.balances.slice(2, 4)].filter((p) => p.length).map((pair, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                  {pair.map((b) => (
                    <BalanceCell key={b.person.id} person={b.person} amount={b.amount} currency={group.currency} />
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {group.spendingByCategory.length > 0 ? (
          <>
            <SectionLabel label={t('group.spendingByCategory')} />
            <Card style={{ padding: 16 }}>
              <CategoryBars data={group.spendingByCategory} currency={group.currency} />
            </Card>
          </>
        ) : null}

        {group.spendingByMonth.some((m) => m.amount > 0) ? (
          <>
            <SectionLabel label={t('group.spendingOverTime')} />
            <Card style={{ padding: 16, paddingTop: 20 }}>
              <MonthBars data={group.spendingByMonth} currency={group.currency} />
            </Card>
          </>
        ) : null}

        <SectionLabel label={t('search.expenses')} right={t('group.expensesCount', { count: group.expenses.length })} />
        {group.expenses.length === 0 ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              {t('group.noExpensesYet')}
            </T>
          </View>
        ) : (
          <Card>
            {group.expenses.map((e, i) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={e.title}
                onPress={() => router.push({ pathname: '/expense', params: { id: e.id } })}
                style={[{ minHeight: 64, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, i > 0 ? rowDivider : null]}
              >
                <View style={{ width: 34, alignItems: 'center' }}>
                  <T serif size={26} lh={1}>
                    {e.day}
                  </T>
                  <T size={11.5} w="bold" upper ls={0.1} color={colors.muted}>
                    {e.mon}
                  </T>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={categoryIcon(e.category)} size={16} color={colors.tileFg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={15} w="semibold">
                    {e.title}
                  </T>
                  <T size={12.5} color={colors.muted}>
                    {e.sub}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T size={12} color={colors.muted}>
                    {e.label}
                  </T>
                  <T size={15} w="bold" color={e.owed ? colors.green : colors.red} num>
                    {rs(e.amount, e.currency)}
                  </T>
                </View>
              </Pressable>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
