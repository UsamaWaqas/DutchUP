import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { rs } from '@/lib/format';
import { categoryIcon } from '@/lib/categories';
import { addComment, ExpenseDetail, fetchExpenseDetail, softDeleteExpense } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Person } from '@/lib/person';
import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Screen, SectionLabel, rowDivider } from '@/components/Layout';
import { Rich, T } from '@/components/Text';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function timeAgo(iso: string, t: TFn): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t('expense.justNow');
  if (mins < 60) return t('expense.minsAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('expense.hoursAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('expense.daysAgo', { count: days });
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fieldLabel(key: string, t: TFn): string {
  const map: Record<string, string> = { description: t('expense.fieldDescription'), amount: t('expense.fieldAmount'), category: t('expense.fieldCategory'), split: t('expense.fieldSplit') };
  return map[key] ?? key;
}

function nameFor(p: Person, t: TFn, userId?: string) {
  return p.id === userId ? t('newGroup.you') : p.name;
}

/** Expense detail — split breakdown, edit history, comments. */
export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const [detail, setDetail] = useState<ExpenseDetail | null>(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    if (!user || !id) return;
    fetchExpenseDetail(id, user.id)
      .then(setDetail)
      .catch((err) => console.error('fetchExpenseDetail (refresh) failed', err));
  }, [user, id]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoadError(false);
      if (user && id) {
        fetchExpenseDetail(id, user.id)
          .then((d) => mounted && setDetail(d))
          .catch((err) => {
            console.error('fetchExpenseDetail failed', err);
            if (mounted) setLoadError(true);
          });
      }
      return () => {
        mounted = false;
      };
    }, [user, id]),
  );

  if (loadError) {
    return (
      <Screen bottomPad={20}>
        <View style={{ height: 48, paddingHorizontal: 8, justifyContent: 'center' }}>
          <IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <T size={14} color={colors.muted}>
            {t('expense.couldntLoad')}
          </T>
        </View>
      </Screen>
    );
  }

  if (!detail || !user) {
    return (
      <Screen bottomPad={20}>
        <View style={{ height: 48, paddingHorizontal: 8, justifyContent: 'center' }}>
          <IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <ActivityIndicator color={colors.deep} />
        </View>
      </Screen>
    );
  }

  const addedBy = detail.payers[0]?.person;

  const confirmDelete = () => {
    Alert.alert(t('expense.deleteExpense'), t('expense.deleteConfirm', { description: detail.description }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('expense.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await softDeleteExpense(detail.id, detail.groupId, user.id, detail.description);
            router.back();
          } catch (e: any) {
            Alert.alert(t('expense.couldntDelete'), e?.message ?? t('common.tryAgain'));
          }
        },
      },
    ]);
  };

  const postComment = async () => {
    const body = commentText.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await addComment(detail.id, user.id, body);
      setCommentText('');
      load();
    } catch (e: any) {
      Alert.alert(t('expense.couldntPostComment'), e?.message ?? t('common.tryAgain'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Screen
      bottomPad={8}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line }}>
          <TextInput
            accessibilityLabel={t('expense.addComment')}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('expense.addComment')}
            placeholderTextColor={colors.muted}
            style={{ flex: 1, minWidth: 0, height: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.ctrl, backgroundColor: colors.bg, fontFamily: 'Manrope_500Medium', fontSize: 14, color: colors.ink }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('expense.postComment')}
            onPress={postComment}
            disabled={!commentText.trim() || posting}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.leather, alignItems: 'center', justifyContent: 'center', opacity: commentText.trim() ? 1 : 0.4 }}
          >
            <Icon name="arrow-right" size={18} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <View style={{ height: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={() => router.back()} />
        <View style={{ flexDirection: 'row' }}>
          {detail.canEdit && detail.splitType !== 'items' ? (
            <IconButton icon="pencil" label={t('expense.editExpense')} onPress={() => router.push({ pathname: '/add-expense', params: { groupId: detail.groupId, expenseId: detail.id } })} />
          ) : null}
          {detail.canDelete ? <IconButton icon="x" label={t('expense.deleteExpense')} color={colors.red} onPress={confirmDelete} /> : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 6, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={categoryIcon(detail.category)} size={22} color={colors.tileFg} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={20} w="bold">
              {detail.description}
            </T>
            <T size={13} color={colors.muted}>
              {formatDate(detail.date)} · {detail.groupName}
            </T>
          </View>
        </View>
        <T serif size={40} lh={1} num>
          {rs(detail.amount, detail.currency)}
        </T>
        {addedBy ? (
          <T size={13} color={colors.muted}>
            {t('expense.addedBy', { name: nameFor(addedBy, t, user.id) })}
            {detail.recurringRule ? t('expense.repeats', { rule: detail.recurringRule }) : ''}
          </T>
        ) : null}

        <SectionLabel label={t('expense.paidBy')} />
        <Card>
          {detail.payers.map((p, i) => (
            <View key={p.person.id} style={[{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
              <Avatar person={p.person} size={34} />
              <T size={15} w="semibold" style={{ flex: 1 }}>
                {nameFor(p.person, t, user.id)}
              </T>
              <T size={15} w="bold" num>
                {rs(p.amount, detail.currency)}
              </T>
            </View>
          ))}
        </Card>

        {detail.items.length > 0 ? (
          <>
            <SectionLabel label={t('expense.receiptItems')} right={t('expense.itemsCount', { count: detail.items.length })} />
            <Card>
              {detail.items.map((it, i) => (
                <View key={it.id} style={[{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, gap: 6 }, i > 0 ? rowDivider : null]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T size={15} w="semibold">
                      {it.name}
                    </T>
                    <T size={15} w="bold" num>
                      {rs(it.price, detail.currency)}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {it.people.map((p) => (
                      <Avatar key={p.id} person={p} size={24} one />
                    ))}
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel label={t('expense.splitBetween')} right={t('expense.peopleCount', { count: detail.splits.length })} />
        <Card>
          {detail.splits.map((s, i) => (
            <View key={s.person.id} style={[{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
              <Avatar person={s.person} size={34} />
              <T size={15} w="semibold" style={{ flex: 1 }}>
                {nameFor(s.person, t, user.id)}
              </T>
              <T size={15} w="bold" color={colors.muted} num>
                {rs(s.amount, detail.currency)}
              </T>
            </View>
          ))}
        </Card>

        {detail.history.length > 0 ? (
          <>
            <SectionLabel label={t('expense.editHistory')} />
            <Card>
              {detail.history.map((h, i) => (
                <View key={h.id} style={[{ padding: 16, gap: 3 }, i > 0 ? rowDivider : null]}>
                  <Rich text={t('expense.changed', { name: `**${nameFor(h.editor, t, user.id)}**`, fields: Object.keys(h.changes).map((k) => fieldLabel(k, t)).join(', ') })} />
                  <T size={12} color={colors.muted}>
                    {timeAgo(h.editedAt, t)}
                  </T>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel label={t('expense.comments')} right={detail.comments.length ? String(detail.comments.length) : undefined} />
        <Card>
          {detail.comments.length === 0 ? (
            <View style={{ padding: 16 }}>
              <T size={13} color={colors.muted}>
                {t('expense.noCommentsYet')}
              </T>
            </View>
          ) : (
            detail.comments.map((c, i) => (
              <View key={c.id} style={[{ padding: 16, flexDirection: 'row', gap: 12 }, i > 0 ? rowDivider : null]}>
                <Avatar person={c.author} size={32} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <T size={13.5} w="semibold">
                    {nameFor(c.author, t, user.id)}
                  </T>
                  <T size={14} lh={1.4}>
                    {c.body}
                  </T>
                  <T size={11.5} color={colors.muted}>
                    {timeAgo(c.createdAt, t)}
                  </T>
                </View>
              </View>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}
