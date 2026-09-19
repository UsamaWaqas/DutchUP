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
import { Person } from '@/lib/person';
import { Avatar, AvatarStack } from '@/components/Avatar';
import { Button, IconButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Eyebrow, Hero, MoneyBig, Screen, SectionLabel, Tile, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

/** Ranked single-series bars: each row is already text-labeled, so one accent colour carries every bar. */
function CategoryBars({ data, currency }: { data: SpendingSlice[]; currency: string }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <View style={{ gap: 12 }}>
      {data.map((d) => (
        <View key={d.label} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} w="semibold">
              {categoryLabel(d.label)}
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
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [picking, setPicking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user || !id) return;
      let mounted = true;
      fetchGroupDetail(id, user.id, profile?.default_currency ?? 'PKR').then((detail) => {
        if (mounted) setGroup(detail);
      });
      return () => {
        mounted = false;
      };
    }, [user, id, profile]),
  );

  if (!group) {
    return (
      <Screen bottomPad={20}>
        <TopBar label="Back to groups" onPress={() => router.back()} />
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
    if (balanceOwners.length === 1) {
      goSettle(balanceOwners[0].person.id);
    } else if (otherMembers.length === 1) {
      goSettle(otherMembers[0].id);
    } else {
      setPicking(true);
    }
  };

  const openGroupMenu = () => {
    Alert.alert(group.name, undefined, [
      {
        text: 'Export expenses (CSV)',
        onPress: async () => {
          try {
            const rows = await fetchGroupExpensesForExport(group.id);
            await exportCsv(group.name, rows);
          } catch (e: any) {
            Alert.alert('Couldn’t export', e?.message ?? 'Please try again.');
          }
        },
      },
      { text: 'Notification settings', onPress: () => router.push('/notifications') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Screen
      bottomPad={20}
      footer={
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 28), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Button label="Settle up" kind="outline" grow={1} onPress={handleSettlePress} />
          <Button label="Add expense" icon="plus" grow={1.3} onPress={() => router.push({ pathname: '/add-expense', params: { groupId: group.id } })} />
        </View>
      }
      overlay={
        picking ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setPicking(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,20,36,0.5)', alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <Pressable style={{ width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Math.max(insets.bottom, 24), paddingTop: 12 }}>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                <T size={16} w="bold">
                  Settle up with
                </T>
              </View>
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
            </Pressable>
          </Pressable>
        ) : undefined
      }
    >
      <TopBar label="Back to groups" onPress={() => router.back()} right={<IconButton icon="more" label="Group settings" onPress={openGroupMenu} />} />
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
                  {`${group.members.length} member${group.members.length === 1 ? '' : 's'}`}
                </T>
              </View>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.hairDeep }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ gap: 8 }}>
              <Eyebrow color={colors.mint}>{group.myNet >= 0 ? 'You’re owed' : 'You owe'}</Eyebrow>
              <MoneyBig value={Math.abs(group.myNet)} currency={group.currency} size={52} rsSize={22} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4, paddingBottom: 4 }}>
              <T size={11.5} upper ls={0.1} color={colors.onDeep}>
                Total spent
              </T>
              <T size={16} w="bold" color={colors.ivory} num>
                {rs(group.totalSpent, group.currency)}
              </T>
            </View>
          </View>
        </Hero>

        {group.balances.length > 0 ? (
          <>
            <SectionLabel label="Balances" right={group.balancesLabel} />
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
            <SectionLabel label="Spending by category" />
            <Card style={{ padding: 16 }}>
              <CategoryBars data={group.spendingByCategory} currency={group.currency} />
            </Card>
          </>
        ) : null}

        {group.spendingByMonth.some((m) => m.amount > 0) ? (
          <>
            <SectionLabel label="Spending over time" />
            <Card style={{ padding: 16, paddingTop: 20 }}>
              <MonthBars data={group.spendingByMonth} currency={group.currency} />
            </Card>
          </>
        ) : null}

        <SectionLabel label="Expenses" right={`${group.expenses.length} expense${group.expenses.length === 1 ? '' : 's'}`} />
        {group.expenses.length === 0 ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              No expenses yet — add the first one below.
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
