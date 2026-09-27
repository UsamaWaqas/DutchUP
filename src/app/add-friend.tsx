import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';
import { addFriend } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Person } from '@/lib/person';
import { Avatar } from '@/components/Avatar';
import { SearchField } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Screen, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

interface Row {
  person: Person;
  pending?: boolean; // typed an email that has no DutchUp account yet
}

/** Add a friend outside of any group, by email. */
export default function AddFriend() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<Row[]>([]);

  const onAdd = async () => {
    const value = email.trim();
    if (!value || !user || adding) return;
    setAdding(true);
    try {
      const result = await addFriend(user.id, value);
      if (added.some((r) => r.person.id === result.person.id)) {
        Alert.alert(t('addFriend.alreadyAdded'), t('addFriend.alreadyAddedBody'));
        return;
      }
      setAdded((cur) => [{ person: result.person, pending: result.pending }, ...cur]);
      setEmail('');
      if (result.pending) {
        Alert.alert(t('addFriend.noAccountYetTitle'), t('addFriend.noAccountYetBody', { email: value }));
      }
    } catch (e: any) {
      Alert.alert(t('addFriend.couldntAdd'), e?.message ?? t('common.tryAgain'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen bottomPad={20}>
      <TopBar title={t('addFriend.title')} icon="x" label={t('common.close')} onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <T size={14} color={colors.muted}>
          {t('addFriend.intro')}
        </T>

        <SearchField placeholder={t('addFriend.emailPlaceholder')} value={email} onChangeText={setEmail} onSubmitEditing={onAdd} keyboardType="email-address" icon={adding ? 'search' : 'user-plus'} />

        {added.length > 0 ? (
          <Card>
            {added.map((r, i) => (
              <View key={r.person.id} style={[{ minHeight: 60, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
                {r.pending ? (
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="mail" size={18} color={colors.tileFg} />
                  </View>
                ) : (
                  <Avatar person={r.person} size={38} />
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={15} w="semibold">
                    {r.person.name}
                  </T>
                  <T size={12.5} color={colors.muted}>
                    {r.pending ? t('addFriend.invitedWillAppear') : t('addFriend.addedAsFriend')}
                  </T>
                </View>
                {r.pending ? null : <Icon name="check" size={18} color={colors.green} strokeWidth={2.4} />}
              </View>
            ))}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
