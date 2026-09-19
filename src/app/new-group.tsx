import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { IconName } from '@/components/iconData';
import { createGroup, findUserByEmail } from '@/lib/queries';
import { useAuth } from '@/lib/auth-context';
import { Person } from '@/lib/person';
import { Avatar } from '@/components/Avatar';
import { Button, Chip, ChipRow, Field, IconButton, SearchField } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Card, Hero, Screen, SectionLabel, Tile, TopBar, rowDivider } from '@/components/Layout';
import { T } from '@/components/Text';

const TYPES = ['Trip', 'Home', 'Event', 'Other'] as const;
type GroupType = (typeof TYPES)[number];
const TYPE_ICON: Record<GroupType, IconName> = { Trip: 'car', Home: 'home', Event: 'calendar', Other: 'users' };

interface Row {
  person: Person;
  admin?: boolean;
  pending?: boolean; // typed an email that has no DutchUp account yet
}

/** 6 · New group — name, type, people and an invite link. */
export default function NewGroup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('Trip');
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [people, setPeople] = useState<Row[]>(() =>
    user ? [{ person: { id: user.id, name: profile?.full_name || 'You', avatarUrl: profile?.avatar_url }, admin: true }] : [],
  );

  const addByEmail = async () => {
    const value = email.trim();
    if (!value || !user) return;
    setSearching(true);
    try {
      const found = await findUserByEmail(value);
      if (people.some((p) => (found ? p.person.id === found.id : p.person.name === value))) {
        Alert.alert('Already added', 'That person is already in this group.');
        return;
      }
      if (found) {
        setPeople((cur) => [...cur, { person: found }]);
      } else {
        setPeople((cur) => [...cur, { person: { id: `pending:${value}`, name: value }, pending: true }]);
        Alert.alert('No DutchUp account yet', `${value} isn’t on DutchUp yet — share the invite link with them after you create the group.`);
      }
      setEmail('');
    } catch (e: any) {
      Alert.alert('Couldn’t look that up', e?.message ?? 'Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const create = async () => {
    if (!user || !name.trim() || creating) return;
    setCreating(true);
    try {
      const members = people.filter((p) => !p.pending).map((p) => p.person);
      const id = await createGroup({ name: name.trim(), icon: TYPE_ICON[type], createdBy: user.id, members });
      router.replace({ pathname: '/group', params: { id } });
    } catch (e: any) {
      Alert.alert('Couldn’t create group', e?.message ?? 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen
      bottomPad={8}
      footer={
        <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 28) }}>
          <Button label={creating ? 'Creating…' : 'Create group'} onPress={create} />
        </View>
      }
    >
      <TopBar title="New group" icon="x" label="Close" onPress={() => router.back()} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
          <View
            style={{ width: 88, height: 88, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ctrl, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Icon name="camera" size={22} color={colors.muted} />
            <T size={12} w="bold" color={colors.muted}>
              Cover
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Murree Trip" />
          </View>
        </View>

        <SectionLabel label="Type" />
        <ChipRow>
          {TYPES.map((t) => (
            <Chip key={t} label={t} selected={t === type} onPress={() => setType(t)} />
          ))}
        </ChipRow>

        <SectionLabel label="People" right={`${people.length} added`} />
        <SearchField placeholder="Add by email" value={email} onChangeText={setEmail} onSubmitEditing={addByEmail} keyboardType="email-address" icon={searching ? 'search' : 'user-plus'} />
        <Card>
          {people.map((p, i) => (
            <View key={p.person.id} style={[{ minHeight: 60, paddingVertical: 8, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, i > 0 ? rowDivider : null]}>
              {p.pending ? (
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="mail" size={18} color={colors.tileFg} />
                </View>
              ) : (
                <Avatar person={p.person} size={38} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={15} w="semibold">
                  {p.person.name}
                </T>
                <T size={12.5} color={colors.muted}>
                  {p.admin ? 'You' : p.pending ? 'Invited · will join when they sign up' : 'On DutchUp'}
                </T>
              </View>
              {p.admin ? (
                <View style={{ marginRight: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.tile }}>
                  <T size={11.5} w="bold" upper ls={0.06} color={colors.deep}>
                    Admin
                  </T>
                </View>
              ) : (
                <IconButton icon="x" label={`Remove ${p.person.name}`} color={colors.muted} onPress={() => setPeople((cur) => cur.filter((x) => x.person.id !== p.person.id))} />
              )}
            </View>
          ))}
        </Card>

        <Hero motifHeight={140} radius={18} padX={16} padTop={18} padBottom={16} gap={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Tile icon="link" size={40} onDeep />
            <View style={{ flex: 1 }}>
              <T size={15} w="bold" color={colors.ivory}>
                Invite with a link
              </T>
              <T size={12.5} color={colors.onDeep}>
                Available once the group is created. Expires in 7 days.
              </T>
            </View>
          </View>
        </Hero>
      </View>
    </Screen>
  );
}
