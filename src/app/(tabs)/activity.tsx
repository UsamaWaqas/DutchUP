import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '@/theme';
import { ActivityItem, ActivitySection, fetchActivity } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card, LargeTitle, Screen, SectionLabel, rowDivider } from '@/components/Layout';
import { Rich, T } from '@/components/Text';

const TONE = { red: colors.red, green: colors.green, muted: colors.muted } as const;

function Row({ item, first }: { item: ActivityItem; first: boolean }) {
  return (
    <View style={[{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, first ? null : rowDivider]}>
      <View style={{ width: 40, height: 40 }}>
        <Avatar person={item.actor} size={40} />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={item.badge} size={10} color={colors.ivory} strokeWidth={2.6} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Rich text={item.text} />
        {item.effect ? (
          <T size={13} w="bold" color={TONE[item.tone ?? 'muted']}>
            {item.effect}
          </T>
        ) : null}
        <T size={12} color={colors.muted}>
          {item.time}
        </T>
      </View>
    </View>
  );
}

/** 4 · Activity — feed grouped by day. */
export default function Activity() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [sections, setSections] = useState<ActivitySection[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let mounted = true;
      setLoadError(false);
      fetchActivity(user.id)
        .then((rows) => {
          if (mounted) setSections(rows);
        })
        .catch((err) => {
          console.error('fetchActivity failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user]),
  );

  return (
    <Screen bottomPad={20}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <LargeTitle title={t('activity.title')} />
        {loadError ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              {t('activity.couldntLoadActivity')}
            </T>
          </View>
        ) : !sections ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.deep} />
          </View>
        ) : sections.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              {t('activity.nothingYet')}
            </T>
          </View>
        ) : (
          sections.map((s) => (
            <React.Fragment key={s.title}>
              <SectionLabel label={s.title} />
              <Card>
                {s.items.map((it, i) => (
                  <Row key={`${it.actor.id}-${it.text}-${i}`} item={it} first={i === 0} />
                ))}
              </Card>
            </React.Fragment>
          ))
        )}
      </View>
    </Screen>
  );
}
