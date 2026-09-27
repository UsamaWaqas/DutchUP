import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme';
import { rs } from '@/lib/format';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import { CURRENCIES, symbolFor } from '@/lib/currencies';
import { addExpense, fetchExpenseDetail, fetchGroups, GroupSummary, updateExpense } from '@/lib/queries';
import { scanReceipt } from '@/lib/receiptScanner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Avatar } from '@/components/Avatar';
import { Button, Checkbox, Chip, ChipRow, Field, IconButton, Segmented } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Eyebrow, Hero, Screen, SectionLabel, Tile, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

type Mode = 'Equally' | 'Exact' | 'Percent' | 'Items';
const BASE_MODES: Mode[] = ['Equally', 'Exact', 'Percent'];
const CREATE_MODES: Mode[] = [...BASE_MODES, 'Items'];
const MODE_PARAM: Record<Mode, string> = { Equally: 'equal', Exact: 'exact', Percent: 'percent', Items: 'items' };
const SPLIT_TYPE: Record<Mode, 'equal' | 'exact' | 'percentage' | 'items'> = { Equally: 'equal', Exact: 'exact', Percent: 'percentage', Items: 'items' };

const REPEAT_OPTIONS: { key: string | null; labelKey: string }[] = [
  { key: null, labelKey: 'repeat.doesNotRepeat' },
  { key: 'weekly', labelKey: 'repeat.weekly' },
  { key: 'fortnightly', labelKey: 'repeat.fortnightly' },
  { key: 'monthly', labelKey: 'repeat.monthly' },
  { key: 'yearly', labelKey: 'repeat.yearly' },
];

const digits = (v: string) => v.replace(/[^0-9]/g, '');
const noOutline = { outlineStyle: 'none' } as object;

/** Split `total` rupees evenly, putting any leftover paisa on the last person. */
function evenSplit(total: number, ids: string[]): Record<string, number> {
  const n = ids.length;
  if (n === 0) return {};
  const base = Math.floor(total / n);
  return Object.fromEntries(ids.map((id, i) => [id, i === n - 1 ? total - base * (n - 1) : base]));
}

interface ExistingExpense {
  expenseId: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: { userId: string; amountOwed: number }[];
  payers: { userId: string; amountPaid: number }[];
}

/** 8 + 9 · Add/edit expense — group picker, then Equally / Exact / Percent / Items, driven by the `mode` route param. */
export default function AddExpense() {
  const { groupId, mode, expenseId } = useLocalSearchParams<{ groupId?: string; mode?: string; expenseId?: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [existing, setExisting] = useState<ExistingExpense | null>(null);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let mounted = true;
      fetchGroups(user.id, profile?.default_currency ?? 'PKR')
        .then((rows) => {
          if (mounted) {
            setGroups(rows);
            if (!expenseId && !groupId && rows.length === 1) router.setParams({ groupId: rows[0].id });
            else if (!expenseId && !groupId && rows.length > 1) setPicking(true);
          }
        })
        .catch((err) => {
          console.error('fetchGroups (add-expense) failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, groupId, expenseId, router, profile]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!user || !expenseId) return;
      let mounted = true;
      fetchExpenseDetail(expenseId, user.id)
        .then((detail) => {
        if (!mounted) return;
        if (!detail.canEdit) {
          Alert.alert(t('addExpense.cantEditTitle'), t('addExpense.cantEditBody'));
          router.back();
          return;
        }
        setExisting({
          expenseId: detail.id,
          description: detail.description,
          amount: detail.amount,
          currency: detail.currency,
          category: detail.category,
          splitType: detail.splitType as ExistingExpense['splitType'],
          splits: detail.splits.map((s) => ({ userId: s.person.id, amountOwed: s.amount })),
          payers: detail.payers.map((p) => ({ userId: p.person.id, amountPaid: p.amount })),
        });
        if (!groupId) router.setParams({ groupId: detail.groupId });
        })
        .catch((err) => {
          console.error('fetchExpenseDetail (edit) failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, expenseId, groupId, router, t]),
  );

  if (loadError) {
    return (
      <Screen bottomPad={8}>
        <TopBar title={expenseId ? t('expense.editExpense') : t('home.addExpense')} icon="x" label={t('common.close')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <T size={14} color={colors.muted}>
            {t('addExpense.couldntLoad')}
          </T>
        </View>
      </Screen>
    );
  }

  if (!groups || (expenseId && !existing)) {
    return (
      <Screen bottomPad={8}>
        <TopBar title={expenseId ? t('expense.editExpense') : t('home.addExpense')} icon="x" label={t('common.close')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <ActivityIndicator color={colors.deep} />
        </View>
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen bottomPad={8}>
        <TopBar title={t('home.addExpense')} icon="x" label={t('common.close')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 }}>
          <T size={15} w="semibold" align="center">
            {t('addExpense.needGroupFirst')}
          </T>
          <T size={13} color={colors.muted} align="center">
            {t('addExpense.createGroupThenAdd')}
          </T>
        </View>
      </Screen>
    );
  }

  // Use the single group directly rather than waiting on the route param round-trip.
  const group = groups.find((g) => g.id === groupId) ?? (groups.length === 1 ? groups[0] : undefined);

  if (!expenseId && (!group || picking)) {
    return (
      <Screen bottomPad={8}>
        <TopBar title={t('addExpense.chooseGroup')} icon="x" label={t('common.close')} onPress={() => router.back()} />
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Card>
            {groups.map((g, i) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                onPress={() => {
                  setPicking(false);
                  router.setParams({ groupId: g.id });
                }}
                style={[{ minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}
              >
                <Tile icon={g.icon} size={40} dark />
                <T size={15} w="semibold">
                  {g.name}
                </T>
              </Pressable>
            ))}
          </Card>
        </View>
      </Screen>
    );
  }

  if (!group) return null; // editing, groupId param not applied yet — next render picks it up

  const m: Mode =
    mode === 'exact'
      ? 'Exact'
      : mode === 'percent'
        ? 'Percent'
        : mode === 'items' && !existing
          ? 'Items'
          : mode === 'equal'
            ? 'Equally'
            : existing?.splitType === 'exact'
              ? 'Exact'
              : existing?.splitType === 'percentage'
                ? 'Percent'
                : 'Equally';
  return (
    <AddExpenseForm
      key={group.id + (existing?.expenseId ?? '')}
      group={group}
      mode={m}
      existing={existing}
      defaultCurrency={profile?.default_currency ?? 'PKR'}
      onPickGroup={() => setPicking(true)}
    />
  );
}

interface DraftItem {
  id: string;
  name: string;
  priceText: string;
  userIds: string[];
}

function AddExpenseForm({
  group,
  mode,
  existing,
  defaultCurrency,
  onPickGroup,
}: {
  group: GroupSummary;
  mode: Mode;
  existing: ExistingExpense | null;
  defaultCurrency: string;
  onPickGroup: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const people = group.members;
  const MODE_LABEL: Record<Mode, string> = { Equally: t('addExpense.equally'), Exact: t('addExpense.exact'), Percent: t('addExpense.percent'), Items: t('addExpense.items') };

  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? CATEGORIES[0].key);
  const [repeat, setRepeat] = useState<string | null>(null);
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [included, setIncluded] = useState<Record<string, boolean>>(() => {
    if (existing) {
      const ids = new Set(existing.splits.map((s) => s.userId));
      return Object.fromEntries(people.map((p) => [p.id, ids.has(p.id)]));
    }
    return Object.fromEntries(people.map((p) => [p.id, true]));
  });
  const [exact, setExact] = useState<Record<string, string>>(() =>
    existing && existing.splitType === 'exact' ? Object.fromEntries(existing.splits.map((s) => [s.userId, String(s.amountOwed)])) : {},
  );
  const [percent, setPercent] = useState<Record<string, string>>(() =>
    existing && existing.splitType === 'percentage' && existing.amount > 0
      ? Object.fromEntries(existing.splits.map((s) => [s.userId, String(Math.round((s.amountOwed / existing.amount) * 100))]))
      : {},
  );
  // Who paid. Defaults to the current user paying the whole thing — the common case —
  // but any subset of the group can be selected, with an amount each once more than one is.
  const [paidBy, setPaidBy] = useState<Record<string, boolean>>(() => {
    if (existing) return Object.fromEntries(existing.payers.map((p) => [p.userId, true]));
    return user ? { [user.id]: true } : {};
  });
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() =>
    existing ? Object.fromEntries(existing.payers.map((p) => [p.userId, String(p.amountPaid)])) : {},
  );
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const itemsTotal = useMemo(() => items.reduce((s, it) => s + Number(it.priceText || 0), 0), [items]);
  const total = mode === 'Items' ? itemsTotal : Number(amountText || 0);

  // Reset to defaults when the member list actually changes (never while editing — initial
  // state above already reflects `existing`). Adjusted during render, React's recommended
  // way to sync state to a changed value, rather than a setState-in-effect extra render pass.
  const peopleKey = existing ? '' : people.map((p) => p.id).join(',');
  const [syncedPeopleKey, setSyncedPeopleKey] = useState(peopleKey);
  if (!existing && peopleKey !== syncedPeopleKey) {
    setSyncedPeopleKey(peopleKey);
    setIncluded(Object.fromEntries(people.map((p) => [p.id, true])));
    setExact({});
    setPercent({});
    setCategory(CATEGORIES[0].key);
    setPaidBy(user ? { [user.id]: true } : {});
    setPayerAmounts({});
  }

  const chosen = people.filter((p) => included[p.id]);
  const each = chosen.length ? Math.round(total / chosen.length) : 0;
  const exactSum = people.reduce((s, p) => s + (included[p.id] ? Number(exact[p.id] || 0) : 0), 0);
  const percentSum = people.reduce((s, p) => s + (included[p.id] ? Number(percent[p.id] || 0) : 0), 0);
  const lastChosen = chosen[chosen.length - 1];
  const evenExact = useMemo(() => evenSplit(total, chosen.map((p) => p.id)), [total, chosen]);
  const adjusted = mode === 'Exact' && lastChosen ? Number(exact[lastChosen.id] || 0) - (evenExact[lastChosen.id] ?? 0) : 0;

  const payerList = people.filter((p) => paidBy[p.id]);
  const singlePayer = payerList.length === 1;
  const payerSum = singlePayer ? total : payerList.reduce((s, p) => s + Number(payerAmounts[p.id] || 0), 0);
  const payersBalanced = payerList.length > 0 && (singlePayer || payerSum === total);

  const addItem = () => setItems((cur) => [...cur, { id: `${Date.now()}-${cur.length}`, name: '', priceText: '', userIds: people.map((p) => p.id) }]);
  const updateItem = (id: string, patch: Partial<DraftItem>) => setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((cur) => cur.filter((it) => it.id !== id));
  const toggleItemPerson = (id: string, personId: string) =>
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, userIds: it.userIds.includes(personId) ? it.userIds.filter((u) => u !== personId) : [...it.userIds, personId] } : it)));
  const itemsBalanced = items.length > 0 && items.every((it) => it.name.trim() && Number(it.priceText || 0) > 0 && it.userIds.length > 0);

  const setMode = (next: Mode) => router.setParams({ mode: MODE_PARAM[next] });

  let stripLeft = t('addExpense.each', { amount: rs(each, currency), count: chosen.length });
  let stripRight = rs(total, currency);
  let balanced = total > 0 && chosen.length > 0;
  if (mode === 'Exact') {
    balanced = exactSum === total && total > 0;
    stripLeft = t('addExpense.assigned');
    stripRight = t('addExpense.ofAmount', { amount: rs(exactSum, currency), total: rs(total, currency) });
  } else if (mode === 'Percent') {
    balanced = percentSum === 100 && total > 0;
    stripLeft = t('addExpense.assigned');
    stripRight = t('addExpense.percentOf100', { percent: percentSum });
  } else if (mode === 'Items') {
    balanced = itemsBalanced;
    stripLeft = t('expense.itemsCount', { count: items.length });
    stripRight = rs(total, currency);
  }

  const runScan = async (source: 'camera' | 'library') => {
    if (scanning) return;
    setScanning(true);
    try {
      const result = await scanReceipt(source);
      if (result && result.amount != null) setAmountText(String(result.amount));
      else if (result) Alert.alert(t('addExpense.scanReceipt'), t('addExpense.couldntReadTotal'));
    } catch (e: any) {
      Alert.alert(t('addExpense.couldntScan'), e?.message ?? t('common.tryAgain'));
    } finally {
      setScanning(false);
    }
  };

  const pickScanSource = () => {
    Alert.alert(t('addExpense.scanReceipt'), undefined, [
      { text: t('addExpense.useCamera'), onPress: () => runScan('camera') },
      { text: t('addExpense.chooseFromLibrary'), onPress: () => runScan('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!user || !description.trim() || !balanced || !payersBalanced || saving) return;
    setSaving(true);
    try {
      const payers = singlePayer ? [{ userId: payerList[0].id, amountPaid: total }] : payerList.map((p) => ({ userId: p.id, amountPaid: Number(payerAmounts[p.id] || 0) }));
      let splits: { userId: string; amountOwed: number; share?: number }[];
      let draftItems: { name: string; price: number; userIds: string[] }[] | undefined;
      if (mode === 'Equally') {
        const amounts = evenSplit(total, chosen.map((p) => p.id));
        splits = chosen.map((p) => ({ userId: p.id, amountOwed: amounts[p.id] }));
      } else if (mode === 'Exact') {
        splits = chosen.map((p) => ({ userId: p.id, amountOwed: Number(exact[p.id] || 0) }));
      } else if (mode === 'Percent') {
        splits = chosen.map((p) => ({ userId: p.id, amountOwed: Math.round((total * Number(percent[p.id] || 0)) / 100), share: Number(percent[p.id] || 0) }));
        const sum = splits.reduce((s, x) => s + x.amountOwed, 0);
        if (splits.length) splits[splits.length - 1].amountOwed += total - sum;
      } else {
        const perPerson = new Map<string, number>();
        for (const it of items) {
          const price = Number(it.priceText || 0);
          const share = it.userIds.length ? Math.round(price / it.userIds.length) : 0;
          for (const uid of it.userIds) perPerson.set(uid, (perPerson.get(uid) ?? 0) + share);
        }
        splits = Array.from(perPerson.entries()).map(([userId, amountOwed]) => ({ userId, amountOwed }));
        draftItems = items.map((it) => ({ name: it.name.trim(), price: Number(it.priceText || 0), userIds: it.userIds }));
      }
      if (existing) {
        await updateExpense({
          expenseId: existing.expenseId,
          groupId: group.id,
          editedBy: user.id,
          description: description.trim(),
          amount: total,
          category,
          splitType: SPLIT_TYPE[mode] as 'equal' | 'exact' | 'percentage',
          splits,
          payers,
          previous: { description: existing.description, amount: existing.amount, category: existing.category, splits: existing.splits },
        });
      } else {
        await addExpense({
          groupId: group.id,
          createdBy: user.id,
          description: description.trim(),
          amount: total,
          currency,
          category,
          splitType: SPLIT_TYPE[mode],
          splits,
          payers,
          recurringRule: repeat,
          items: draftItems,
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert(t('addExpense.couldntSave'), e?.message ?? t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      bottomPad={8}
      footer={
        <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 28) }}>
          <Button label={saving ? t('settle.saving') : existing ? t('addExpense.saveChanges') : t('addExpense.saveExpense')} onPress={save} />
        </View>
      }
      overlay={
        pickingCurrency ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setPickingCurrency(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,20,36,0.5)', alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <Pressable style={{ width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Math.max(insets.bottom, 24), paddingTop: 12, maxHeight: '70%' }}>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                <T size={16} w="bold">
                  {t('addExpense.currency')}
                </T>
              </View>
              <Card style={{ marginHorizontal: 20 }}>
                {CURRENCIES.map((c, i) => (
                  <Pressable
                    key={c.code}
                    accessibilityRole="button"
                    onPress={() => {
                      setCurrency(c.code);
                      setPickingCurrency(false);
                    }}
                    style={[{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}
                  >
                    <T size={15} w="bold" style={{ width: 44 }}>
                      {c.symbol}
                    </T>
                    <T size={15} w="semibold" style={{ flex: 1 }}>
                      {c.name}
                    </T>
                    <T size={13} color={colors.muted}>
                      {c.code}
                    </T>
                  </Pressable>
                ))}
              </Card>
            </Pressable>
          </Pressable>
        ) : undefined
      }
    >
      <TopBar title={existing ? t('expense.editExpense') : t('home.addExpense')} icon="x" label={t('common.close')} onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <View style={{ flexDirection: 'row' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('addExpense.group', { name: group.name })}
            onPress={existing ? undefined : onPickGroup}
            style={{ height: 48, paddingLeft: 8, paddingRight: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.ctrl, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Tile icon={group.icon} size={32} dark />
            <T size={14} w="bold">
              {group.name}
            </T>
            {existing ? null : <Icon name="chevron-down" size={17} />}
          </Pressable>
        </View>

        <Hero motifHeight={150} padX={20} padTop={18} padBottom={14} gap={4}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Eyebrow>{mode === 'Items' ? t('addExpense.totalFromItems') : t('addExpense.amount')}</Eyebrow>
            {!existing && mode !== 'Items' ? (
              scanning ? (
                <ActivityIndicator accessibilityLabel={t('addExpense.scanning')} color={colors.onDeep} size="small" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('addExpense.scanReceipt')}
                  onPress={pickScanSource}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(246,243,234,0.5)' }}
                >
                  <Icon name="camera" size={14} color={colors.ivory} />
                  <T size={12} w="bold" color={colors.ivory}>
                    {t('addExpense.scanReceipt')}
                  </T>
                </Pressable>
              )
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T serif size={28} color={colors.onDeep}>
              {symbolFor(currency)}
            </T>
            {mode === 'Items' ? (
              <T serif size={62} lh={1} color={colors.ivory} style={{ flex: 1 }} num>
                {total.toLocaleString('en-US')}
              </T>
            ) : (
              <TextInput
                accessibilityLabel={t('addExpense.amount')}
                value={total ? total.toLocaleString('en-US') : ''}
                onChangeText={(v) => setAmountText(digits(v))}
                placeholder="0"
                placeholderTextColor="rgba(246,243,234,0.4)"
                keyboardType="number-pad"
                style={[{ flex: 1, minWidth: 0, height: 70, padding: 0, color: colors.ivory, fontFamily: 'InstrumentSerif_400Regular', fontSize: 62, letterSpacing: -0.62, fontVariant: ['tabular-nums'] }, noOutline]}
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('addExpense.currencyLabel', { code: currency })}
              onPress={existing ? undefined : () => setPickingCurrency(true)}
              style={{ height: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(246,243,234,0.5)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <T size={13} w="bold" color={colors.ivory}>
                {currency}
              </T>
              {existing ? null : <Icon name="chevron-down" size={15} color={colors.ivory} />}
            </Pressable>
          </View>
        </Hero>

        <Field label={t('addExpense.description')} value={description} onChangeText={setDescription} placeholder={t('addExpense.whatWasItFor')} />
        <ChipRow>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={categoryLabel(c.key, t)} icon={c.icon} selected={c.key === category} onPress={() => setCategory(c.key)} />
          ))}
          <Chip label={t('addExpense.today')} icon="calendar" />
        </ChipRow>

        {existing ? null : (
          <>
            <SectionLabel label={t('addExpense.repeats')} />
            <ChipRow>
              {REPEAT_OPTIONS.map((o) => (
                <Chip key={o.labelKey} label={t(o.labelKey)} selected={o.key === repeat} onPress={() => setRepeat(o.key)} />
              ))}
            </ChipRow>
          </>
        )}

        <SectionLabel label={t('expense.paidBy')} right={t('addExpense.selectedCount', { selected: payerList.length, total: people.length })} />
        <Card>
          {people.map((p, i) => {
            const on = !!paidBy[p.id];
            const name = p.id === user?.id ? t('newGroup.you') : p.name;
            return (
              <View key={p.id} style={[{ minHeight: 58, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
                <Checkbox checked={on} label={t('addExpense.personPaid', { name })} onChange={(v) => setPaidBy((cur) => ({ ...cur, [p.id]: v }))} />
                <Avatar person={p} size={34} />
                <T size={15} w={on ? 'semibold' : 'medium'} style={{ flex: 1 }}>
                  {name}
                </T>
                {!on ? null : singlePayer ? (
                  <T size={15} w="bold" num>
                    {rs(total, currency)}
                  </T>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T size={13} color={colors.muted}>
                      {symbolFor(currency)}
                    </T>
                    <TextInput
                      accessibilityLabel={t('addExpense.amountPaidBy', { name })}
                      keyboardType="number-pad"
                      value={payerAmounts[p.id] ?? ''}
                      onChangeText={(v) => setPayerAmounts((c) => ({ ...c, [p.id]: digits(v) }))}
                      style={[{ width: 88, height: 44, paddingHorizontal: 12, textAlign: 'right', borderWidth: 1, borderColor: colors.ctrl, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 15, fontVariant: ['tabular-nums'] }, noOutline]}
                    />
                  </View>
                )}
              </View>
            );
          })}
          {payerList.length > 1 ? (
            <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: payersBalanced ? colors.balancedBg : colors.warnBg }}>
              <T size={13.5} w="bold" color={payersBalanced ? colors.balancedFg : colors.warnFg}>
                {t('addExpense.paid')}
              </T>
              <T size={13.5} w="bold" color={payersBalanced ? colors.balancedFg : colors.warnFg} num>
                {t('addExpense.ofAmount', { amount: rs(payerSum, currency), total: rs(total, currency) })}
              </T>
            </View>
          ) : null}
        </Card>

        <SectionLabel label={t('expense.splitBetween')} right={mode === 'Items' ? undefined : t('addExpense.selectedCount', { selected: chosen.length, total: people.length })} />
        <Segmented<Mode> items={existing ? BASE_MODES : CREATE_MODES} active={mode} onChange={setMode} labels={MODE_LABEL} />

        {mode === 'Items' ? (
          <View style={{ gap: 12 }}>
            {items.map((it, idx) => (
              <Card key={it.id}>
                <View style={{ padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      accessibilityLabel={t('addExpense.itemName', { n: idx + 1 })}
                      value={it.name}
                      onChangeText={(v) => updateItem(it.id, { name: v })}
                      placeholder={t('addExpense.itemNamePlaceholder')}
                      placeholderTextColor={colors.muted}
                      style={[{ flex: 1, height: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.ctrl, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink, fontFamily: 'Manrope_500Medium', fontSize: 14 }, noOutline]}
                    />
                    <TextInput
                      accessibilityLabel={t('addExpense.itemPrice', { n: idx + 1 })}
                      value={it.priceText}
                      onChangeText={(v) => updateItem(it.id, { priceText: digits(v) })}
                      placeholder="0"
                      keyboardType="number-pad"
                      style={[{ width: 90, height: 44, paddingHorizontal: 12, textAlign: 'right', borderWidth: 1, borderColor: colors.ctrl, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 15, fontVariant: ['tabular-nums'] }, noOutline]}
                    />
                    <IconButton icon="x" label={t('addExpense.removeItem', { n: idx + 1 })} color={colors.muted} onPress={() => removeItem(it.id)} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {people.map((p) => (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: it.userIds.includes(p.id) }}
                        onPress={() => toggleItemPerson(it.id, p.id)}
                        style={{ opacity: it.userIds.includes(p.id) ? 1 : 0.35 }}
                      >
                        <Avatar person={p} size={30} one />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Card>
            ))}
            <Button label={t('addExpense.addItem')} kind="outline" onPress={addItem} />
            <View style={{ minHeight: 48, paddingHorizontal: 16, borderRadius: radii.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: balanced ? colors.balancedBg : colors.warnBg }}>
              <T size={13.5} w="bold" color={balanced ? colors.balancedFg : colors.warnFg}>
                {stripLeft}
              </T>
              <T size={13.5} w="bold" color={balanced ? colors.balancedFg : colors.warnFg} num>
                {stripRight}
              </T>
            </View>
          </View>
        ) : (
          <Card>
            {people.map((p, i) => {
              const on = !!included[p.id];
              const sub = mode === 'Exact' && p.id === lastChosen?.id && adjusted !== 0 ? t('addExpense.adjustedBy', { amount: rs(Math.abs(adjusted), currency) }) : undefined;
              return (
                <View key={p.id} style={[{ minHeight: 58, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
                  <Checkbox checked={on} label={t('addExpense.includePerson', { name: p.name })} onChange={(v) => setIncluded((cur) => ({ ...cur, [p.id]: v }))} />
                  <Avatar person={p} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={15} w={on ? 'semibold' : 'medium'}>
                      {p.name}
                    </T>
                    {sub ? (
                      <T size={12} w="bold" color={colors.green}>
                        {sub}
                      </T>
                    ) : null}
                  </View>
                  {mode === 'Equally' ? (
                    on ? (
                      <T size={15} w="bold" num>
                        {rs(each, currency)}
                      </T>
                    ) : (
                      <T size={13} color={colors.muted}>
                        {t('addExpense.notIncluded')}
                      </T>
                    )
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: on ? 1 : 0.4 }}>
                      {mode === 'Exact' ? (
                        <T size={13} color={colors.muted}>
                          {symbolFor(currency)}
                        </T>
                      ) : null}
                      <TextInput
                        accessibilityLabel={mode === 'Exact' ? t('addExpense.amountFor', { name: p.name }) : t('addExpense.percentFor', { name: p.name })}
                        editable={on}
                        keyboardType="number-pad"
                        value={mode === 'Exact' ? exact[p.id] ?? '' : percent[p.id] ?? ''}
                        onChangeText={(v) => (mode === 'Exact' ? setExact((c) => ({ ...c, [p.id]: digits(v) })) : setPercent((c) => ({ ...c, [p.id]: digits(v) })))}
                        style={[{ width: 88, height: 44, paddingHorizontal: 12, textAlign: 'right', borderWidth: 1, borderColor: colors.ctrl, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink, fontFamily: 'Manrope_700Bold', fontSize: 15, fontVariant: ['tabular-nums'] }, noOutline]}
                      />
                      {mode === 'Percent' ? (
                        <T size={13} color={colors.muted}>
                          %
                        </T>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: balanced ? colors.balancedBg : colors.warnBg }}>
              <T size={13.5} w="bold" color={balanced ? colors.balancedFg : colors.warnFg}>
                {stripLeft}
              </T>
              <T size={13.5} w="bold" color={balanced ? colors.balancedFg : colors.warnFg} num>
                {stripRight}
              </T>
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}
