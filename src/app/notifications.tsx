import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@/theme';
import { fetchGroups, fetchNotificationSettings, GroupSummary, setGroupMuted } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Checkbox } from '@/components/Controls';
import { Card, Screen, SectionLabel, Tile, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

/** Per-group mute toggles, backed by the notification_settings table. */
export default function Notifications() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let mounted = true;
      setLoadError(false);
      Promise.all([fetchGroups(user.id, profile?.default_currency ?? 'PKR'), fetchNotificationSettings(user.id)])
        .then(([g, m]) => {
          if (mounted) {
            setGroups(g);
            setMuted(m);
          }
        })
        .catch((err) => {
          console.error('fetchNotificationSettings failed', err);
          if (mounted) setLoadError(true);
        });
      return () => {
        mounted = false;
      };
    }, [user, profile]),
  );

  const toggle = async (groupId: string) => {
    if (!user) return;
    const next = !muted[groupId];
    setMuted((cur) => ({ ...cur, [groupId]: next }));
    try {
      await setGroupMuted(user.id, groupId, next);
    } catch {
      setMuted((cur) => ({ ...cur, [groupId]: !next }));
    }
  };

  return (
    <Screen bottomPad={20}>
      <TopBar title={t('notifications.title')} label={t('common.back')} onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <T size={13} color={colors.muted}>
          {t('notifications.muteExplain')}
        </T>

        {loadError ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <T size={14} color={colors.muted}>
              {t('notifications.couldntLoadGroups')}
            </T>
          </View>
        ) : !groups ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.deep} />
          </View>
        ) : groups.length === 0 ? (
          <T size={14} color={colors.muted}>
            {t('notifications.notInAnyGroups')}
          </T>
        ) : (
          <>
            <SectionLabel label={t('groups.title')} />
            <Card>
              {groups.map((g, i) => (
                <View key={g.id} style={[{ minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
                  <Tile icon={g.icon} size={36} dark />
                  <T size={15} w="semibold" style={{ flex: 1 }}>
                    {g.name}
                  </T>
                  <T size={12.5} color={colors.muted} style={{ marginRight: 8 }}>
                    {muted[g.id] ? t('notifications.muted') : t('notifications.on')}
                  </T>
                  <Checkbox checked={!!muted[g.id]} label={t('notifications.muteGroup', { name: g.name })} onChange={() => toggle(g.id)} />
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}
