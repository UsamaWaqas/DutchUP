import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';
import { addFriend } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
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
        Alert.alert('Already added', 'You already added that person.');
        return;
      }
      setAdded((cur) => [{ person: result.person, pending: result.pending }, ...cur]);
      setEmail('');
      if (result.pending) {
        Alert.alert('No DutchUp account yet', `${value} isn't on DutchUp yet. Once they sign up with this email, they'll show up in your groups.`);
      }
    } catch (e: any) {
      Alert.alert("Couldn't add friend", e?.message ?? 'Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen bottomPad={20}>
      <TopBar title="Add a friend" icon="x" label="Close" onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <T size={14} color={colors.muted}>
          Add someone by email — no group needed. They'll show up here once they're on DutchUp.
        </T>

        <SearchField placeholder="Friend's email" value={email} onChangeText={setEmail} onSubmitEditing={onAdd} keyboardType="email-address" icon={adding ? 'search' : 'user-plus'} />

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
                    {r.pending ? 'Invited · will appear when they sign up' : 'Added as a friend'}
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
