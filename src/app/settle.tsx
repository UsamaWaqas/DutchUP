import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { symbolFor } from '@/lib/currencies';
import { fetchPairBalance, fetchProfile, settleUp } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Person } from '@/lib/person';
import { Avatar } from '@/components/Avatar';
import { Button, Chip, ChipRow, Field } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { IconName } from '@/components/iconData';
import { Card, Screen, SectionLabel, Hero, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

const METHODS = ['Cash', 'Bank', 'Easypaisa', 'JazzCash'] as const;

function linkOuts(name: string, t: (key: string, vars?: Record<string, string | number>) => string): { title: string; sub: string; icon: IconName; action: IconName }[] {
  const first = name.split(' ')[0];
  return [
    { title: 'Easypaisa', sub: t('settle.opensApp'), icon: 'wallet', action: 'arrow-up-right' },
    { title: 'JazzCash', sub: t('settle.opensApp'), icon: 'wallet', action: 'arrow-up-right' },
    { title: t('settle.bankTransfer'), sub: t('settle.copiesAccountDetails', { name: first }), icon: 'landmark', action: 'copy' },
  ];
}

function DashedLine() {
  return (
    <View style={{ flex: 1, height: 2 }}>
      <Svg width="100%" height={2}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(246,243,234,0.4)" strokeWidth={1.5} strokeDasharray="4 3" />
      </Svg>
    </View>
  );
}

/** 7 · Settle up — record a payment between the current user and one other member. */
export default function Settle() {
  const { groupId, otherUserId } = useLocalSearchParams<{ groupId: string; otherUserId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const currency = profile?.default_currency ?? 'PKR';
  const METHOD_LABEL: Record<(typeof METHODS)[number], string> = { Cash: t('settle.methodCash'), Bank: t('settle.methodBank'), Easypaisa: 'Easypaisa', JazzCash: 'JazzCash' };
  const [other, setOther] = useState<Person | null>(null);
  // positive: `other` owes the current user; negative: the current user owes `other`.
  const [signedBalance, setSignedBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('Cash');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user || !groupId || !otherUserId) return;
      let mounted = true;
      setLoadError(false);
      Promise.all([fetchProfile(otherUserId), fetchPairBalance(groupId, user.id, otherUserId, currency)])
        .then(([person, signed]) => {
          if (!mounted) return;
          setOther(person);
          setSignedBalance(signed);
          const abs = Math.round(Math.abs(signed));
          setAmount(abs ? String(abs) : '');
        })
        .catch((err) => {
          console.error('settle screen load failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, groupId, otherUserId, currency]),
  );

  if (loadError) {
    return (
      <Screen bottomPad={8}>
        <TopBar title={t('settle.title')} label={t('common.back')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <T size={14} color={colors.muted}>
            {t('settle.couldntLoad')}
          </T>
        </View>
      </Screen>
    );
  }

  if (!other || !user) {
    return (
      <Screen bottomPad={8}>
        <TopBar title={t('settle.title')} label={t('common.back')} onPress={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <ActivityIndicator color={colors.deep} />
        </View>
      </Screen>
    );
  }

  const value = Number(amount || 0);
  const theyOweMe = signedBalance > 0.5;
  const fromUser = theyOweMe ? other.id : user.id;
  const toUser = theyOweMe ? user.id : other.id;
  const toName = theyOweMe ? t('newGroup.you') : other.name;

  const markPaid = async () => {
    if (!value || saving) return;
    setSaving(true);
    try {
      await settleUp({ groupId, fromUser, toUser, toName, amount: value, currency, method, note: note.trim() || undefined });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      Alert.alert(t('settle.couldntRecord'), e?.message ?? t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      bottomPad={8}
      footer={
        <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 28) }}>
          <Button label={saving ? t('settle.saving') : t('settle.markAsPaid')} icon="check" onPress={markPaid} />
        </View>
      }
    >
      <TopBar title={t('settle.title')} label={t('common.back')} onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <Hero motifHeight={260} padTop={22} padBottom={20} gap={12}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar person={{ id: user.id, name: t('newGroup.you') }} size={52} dark />
            <DashedLine />
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrow-right" size={17} color={colors.deep} strokeWidth={2.2} />
            </View>
            <DashedLine />
            <Avatar person={other} size={52} dark />
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <T size={14} color={colors.onDeep}>
              {theyOweMe ? (
                <>
                  <T size={14} w="bold" color={colors.ivory}>
                    {other.name}
                  </T>{' '}
                  {t('home.owesYou')}
                </>
              ) : (
                <>
                  {t('home.youOwe')}{' '}
                  <T size={14} w="bold" color={colors.ivory}>
                    {other.name}
                  </T>
                </>
              )}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <T serif size={28} color={colors.onDeep}>
                {symbolFor(currency)}
              </T>
              <TextInput
                accessibilityLabel={t('settle.amountPaid')}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={[{ width: 150, height: 72, padding: 0, color: colors.ivory, fontFamily: 'InstrumentSerif_400Regular', fontSize: 64, letterSpacing: -0.64, fontVariant: ['tabular-nums'] }, { outlineStyle: 'none' } as object]}
              />
            </View>
            <T size={12.5} color={colors.onDeep} align="center">
              {Math.abs(signedBalance) > 0.5
                ? t('settle.paidDifferentAmount')
                : theyOweMe
                  ? t('settle.recordingFrom', { name: other.name.split(' ')[0] })
                  : t('settle.recordingTo', { name: other.name.split(' ')[0] })}
            </T>
          </View>
        </Hero>

        <SectionLabel label={t('settle.paidVia')} />
        <ChipRow>
          {METHODS.map((m) => (
            <Chip key={m} label={METHOD_LABEL[m]} selected={m === method} onPress={() => setMethod(m)} />
          ))}
        </ChipRow>

        {!theyOweMe ? (
          <>
            <SectionLabel label={t('settle.payFirstOptional', { name: other.name.split(' ')[0] })} />
            <Card>
              {linkOuts(other.name, t).map((r, i) => (
                <Pressable
                  key={r.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.title}. ${r.sub}`}
                  style={[{ minHeight: 62, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={r.icon} size={18} color={colors.tileFg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T size={15} w="semibold">
                      {r.title}
                    </T>
                    <T size={12.5} color={colors.muted}>
                      {r.sub}
                    </T>
                  </View>
                  <Icon name={r.action} size={19} color={colors.muted} />
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}
        <T size={12.5} lh={1.5} color={colors.muted}>
          {t('settle.onlyRecordsPayments')}
        </T>
        <Field label={t('settle.noteOptional')} value={note} onChangeText={setNote} placeholder={t('settle.notePlaceholder')} />
      </View>
    </Screen>
  );
}
