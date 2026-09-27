import type { IconName } from '@/components/iconData';
import { rs } from './format';
import { netBalances, simplifyDebts } from './balances';
import { getRate } from './exchangeRates';
import { Person } from './person';
import { supabase } from './supabase';

function toPerson(row: { id: string; full_name: string | null; avatar_url: string | null } | null | undefined): Person {
  return { id: row?.id ?? '', name: row?.full_name || 'Someone', avatarUrl: row?.avatar_url ?? null };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One `getRate` call per distinct currency actually present, not per row. */
async function rateMapFor(currencies: string[], to: string): Promise<Record<string, number>> {
  const unique = Array.from(new Set(currencies)).filter((c) => c && c !== to);
  const pairs = await Promise.all(unique.map(async (c) => [c, await getRate(c, to)] as const));
  return Object.fromEntries(pairs);
}

export async function fetchProfile(userId: string): Promise<Person> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', userId).single();
  if (error) throw error;
  return toPerson(data);
}

/* --------------------------------------------------------- shared group ledger */
interface GroupLedger {
  groupId: string;
  groupName: string;
  groupIcon: IconName;
  members: Person[];
  nets: Record<string, number>;
}

/**
 * One round trip per table, batched across every group the user belongs to. Every
 * amount is converted to `viewerCurrency` on the way in, so the nets this returns are
 * always comparable even when the group mixes expense currencies.
 */
async function fetchGroupLedgers(userId: string, viewerCurrency: string): Promise<GroupLedger[]> {
  const { data: myMemberships, error } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
  if (error) throw error;
  const groupIds = Array.from(new Set((myMemberships ?? []).map((r) => r.group_id as string)));
  if (groupIds.length === 0) return [];

  const [{ data: groupRows, error: gErr }, { data: memberRows, error: mErr }, { data: expenseRows, error: eErr }, { data: settlementRows, error: sErr }] = await Promise.all([
    supabase.from('groups').select('id, name, icon').in('id', groupIds),
    supabase.from('group_members').select('group_id, profiles(id, full_name, avatar_url)').in('group_id', groupIds),
    supabase.from('expenses').select('group_id, currency, expense_payers(user_id, amount_paid), expense_splits(user_id, amount_owed)').in('group_id', groupIds).is('deleted_at', null),
    supabase.from('settlements').select('group_id, from_user, to_user, amount, currency').in('group_id', groupIds),
  ]);
  if (gErr) throw gErr;
  if (mErr) throw mErr;
  if (eErr) throw eErr;
  if (sErr) throw sErr;

  const currencies = [...(expenseRows ?? []).map((e) => e.currency as string), ...(settlementRows ?? []).map((s) => s.currency as string)];
  const rateMap = await rateMapFor(currencies, viewerCurrency);
  const conv = (amount: number, from: string) => amount * (rateMap[from] ?? 1);

  return (groupRows ?? []).map((g) => {
    const members = (memberRows ?? []).filter((m) => m.group_id === g.id).map((m) => toPerson(m.profiles as any));
    const groupExpenses = (expenseRows ?? []).filter((e) => e.group_id === g.id);
    const payers = groupExpenses.flatMap((e) => (e.expense_payers as any[]).map((p) => ({ userId: p.user_id as string, amountPaid: conv(Number(p.amount_paid), e.currency as string) })));
    const splits = groupExpenses.flatMap((e) => (e.expense_splits as any[]).map((s) => ({ userId: s.user_id as string, amountOwed: conv(Number(s.amount_owed), e.currency as string) })));
    const settlements = (settlementRows ?? [])
      .filter((s) => s.group_id === g.id)
      .map((s) => ({ fromUser: s.from_user as string, toUser: s.to_user as string, amount: conv(Number(s.amount), s.currency as string) }));
    return { groupId: g.id as string, groupName: g.name as string, groupIcon: g.icon as IconName, members, nets: netBalances({ payers, splits, settlements }) };
  });
}

/* ------------------------------------------------------------------- groups */
export interface GroupSummary {
  id: string;
  name: string;
  icon: IconName;
  members: Person[];
  status: 'owed' | 'owe' | 'settled';
  amount: number;
  currency: string;
}

export async function fetchGroups(userId: string, viewerCurrency: string): Promise<GroupSummary[]> {
  const ledgers = await fetchGroupLedgers(userId, viewerCurrency);
  return ledgers.map((l) => {
    const net = l.nets[userId] ?? 0;
    return {
      id: l.groupId,
      name: l.groupName,
      icon: l.groupIcon,
      members: l.members,
      status: net > 0.5 ? 'owed' : net < -0.5 ? 'owe' : 'settled',
      amount: Math.round(Math.abs(net)),
      currency: viewerCurrency,
    };
  });
}

/* -------------------------------------------------------------------- search */
export interface SearchResults {
  groups: { id: string; name: string; icon: IconName }[];
  expenses: { id: string; description: string; amount: number; currency: string; groupId: string | null; groupName: string | null }[];
}

/** Groups by name + expenses by description, both scoped by RLS to what the user can already see. */
export async function searchAll(userId: string, queryText: string): Promise<SearchResults> {
  const q = queryText.trim();
  if (!q) return { groups: [], expenses: [] };

  const [{ data: memberRows, error: mErr }, { data: expenseRows, error: eErr }] = await Promise.all([
    supabase.from('group_members').select('groups(id, name, icon)').eq('user_id', userId),
    supabase
      .from('expenses')
      .select('id, description, amount, currency, group_id, groups(name)')
      .ilike('description', `%${q}%`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (mErr) throw mErr;
  if (eErr) throw eErr;

  const needle = q.toLowerCase();
  const groups = (memberRows ?? [])
    .map((r) => r.groups as unknown as { id: string; name: string; icon: IconName } | null)
    .filter((g): g is { id: string; name: string; icon: IconName } => !!g && g.name.toLowerCase().includes(needle));

  const expenses = (expenseRows ?? []).map((e) => ({
    id: e.id as string,
    description: e.description as string,
    amount: Number(e.amount),
    currency: e.currency as string,
    groupId: e.group_id as string | null,
    groupName: (e.groups as any)?.name ?? null,
  }));

  return { groups, expenses };
}

/* ------------------------------------------------------- recurring expenses */
function addInterval(dateStr: string, rule: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (rule === 'weekly') dt.setUTCDate(dt.getUTCDate() + 7);
  else if (rule === 'fortnightly') dt.setUTCDate(dt.getUTCDate() + 14);
  else if (rule === 'monthly') dt.setUTCMonth(dt.getUTCMonth() + 1);
  else if (rule === 'yearly') dt.setUTCFullYear(dt.getUTCFullYear() + 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Materializes any past-due occurrences of the current user's own recurring expense
 * templates in this group. Only ever processes templates this user created — RLS on
 * `expenses`/`expense_payers`/`expense_splits` requires `created_by = auth.uid()`, so a
 * client can only generate future occurrences on its own signed-in user's behalf.
 */
async function materializeRecurringExpenses(groupId: string, userId: string): Promise<void> {
  const { data: templates, error } = await supabase
    .from('expenses')
    .select('id, description, amount, currency, category, split_type, expense_date, recurring_rule, expense_payers(user_id, amount_paid), expense_splits(user_id, amount_owed, share)')
    .eq('group_id', groupId)
    .eq('created_by', userId)
    .is('deleted_at', null)
    .is('recurring_parent_id', null)
    .not('recurring_rule', 'is', null);
  if (error) throw error;
  if (!templates || templates.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  for (const t of templates) {
    const rule = t.recurring_rule as string;
    const { data: children, error: cErr } = await supabase
      .from('expenses')
      .select('expense_date')
      .eq('recurring_parent_id', t.id)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .limit(1);
    if (cErr) throw cErr;
    let lastDate = (children && children[0]?.expense_date) || (t.expense_date as string);
    let next = addInterval(lastDate, rule);
    let guard = 0;
    while (next <= today && guard < 24) {
      const { data: created, error: insErr } = await supabase
        .from('expenses')
        .insert({
          group_id: groupId,
          description: t.description,
          amount: t.amount,
          currency: t.currency,
          category: t.category,
          split_type: t.split_type,
          expense_date: next,
          recurring_rule: rule,
          recurring_parent_id: t.id,
          created_by: userId,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const newId = created.id as string;

      const payers = t.expense_payers as any[];
      const splits = t.expense_splits as any[];
      await supabase.from('expense_payers').insert(payers.map((p) => ({ expense_id: newId, user_id: p.user_id, amount_paid: p.amount_paid })));
      await supabase.from('expense_splits').insert(splits.map((s) => ({ expense_id: newId, user_id: s.user_id, amount_owed: s.amount_owed, share: s.share })));
      await supabase.from('activity_log').insert({
        group_id: groupId,
        actor_id: userId,
        action_type: 'expense_added',
        payload: { description: t.description, amount: t.amount, currency: t.currency, expense_id: newId, paid_by: userId, splits: splits.map((s) => ({ user_id: s.user_id, amount_owed: s.amount_owed })) },
      });

      lastDate = next;
      next = addInterval(next, rule);
      guard++;
    }
  }
}

/* ------------------------------------------------------------- group detail */
export interface GroupExpenseRow {
  id: string;
  day: string;
  mon: string;
  title: string;
  sub: string;
  label: string;
  amount: number;
  owed: boolean;
  category: string;
  currency: string;
}

export interface SpendingSlice {
  label: string;
  amount: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  icon: IconName;
  members: Person[];
  totalSpent: number;
  currency: string;
  myNet: number;
  balances: { person: Person; amount: number }[];
  balancesLabel: 'They owe you' | 'You owe';
  expenses: GroupExpenseRow[];
  spendingByCategory: SpendingSlice[];
  spendingByMonth: SpendingSlice[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function fetchGroupDetail(groupId: string, userId: string, viewerCurrency: string): Promise<GroupDetail> {
  await materializeRecurringExpenses(groupId, userId);

  const [{ data: group, error: gErr }, { data: memberRows, error: mErr }, { data: expenseRows, error: eErr }, { data: settlementRows, error: sErr }] = await Promise.all([
    supabase.from('groups').select('id, name, icon').eq('id', groupId).single(),
    supabase.from('group_members').select('profiles(id, full_name, avatar_url)').eq('group_id', groupId),
    supabase
      .from('expenses')
      .select('id, description, amount, currency, category, expense_date, expense_payers(user_id, amount_paid, profiles(full_name)), expense_splits(user_id, amount_owed)')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('settlements').select('from_user, to_user, amount, currency').eq('group_id', groupId),
  ]);
  if (gErr) throw gErr;
  if (mErr) throw mErr;
  if (eErr) throw eErr;
  if (sErr) throw sErr;

  const members = (memberRows ?? []).map((r) => toPerson(r.profiles as any));

  const currencies = [...(expenseRows ?? []).map((e) => e.currency as string), ...(settlementRows ?? []).map((s) => s.currency as string)];
  const rateMap = await rateMapFor(currencies, viewerCurrency);
  const conv = (amount: number, from: string) => amount * (rateMap[from] ?? 1);

  const payers = (expenseRows ?? []).flatMap((e) => (e.expense_payers as any[]).map((p) => ({ userId: p.user_id as string, amountPaid: conv(Number(p.amount_paid), e.currency as string) })));
  const splits = (expenseRows ?? []).flatMap((e) => (e.expense_splits as any[]).map((s) => ({ userId: s.user_id as string, amountOwed: conv(Number(s.amount_owed), e.currency as string) })));
  const settlements = (settlementRows ?? []).map((s) => ({ fromUser: s.from_user as string, toUser: s.to_user as string, amount: conv(Number(s.amount), s.currency as string) }));
  const nets = netBalances({ payers, splits, settlements });
  const myNet = nets[userId] ?? 0;

  const edges = simplifyDebts(nets);
  const peopleById = new Map(members.map((p) => [p.id, p]));
  const relevant = myNet >= 0 ? edges.filter((e) => e.to === userId) : edges.filter((e) => e.from === userId);
  const balances = relevant
    .map((e) => ({ person: peopleById.get(myNet >= 0 ? e.from : e.to), amount: e.amount }))
    .filter((b): b is { person: Person; amount: number } => !!b.person)
    .sort((a, b) => b.amount - a.amount);

  const totalSpent = (expenseRows ?? []).reduce((sum, e) => sum + conv(Number(e.amount), e.currency as string), 0);

  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const e of expenseRows ?? []) {
    const converted = conv(Number(e.amount), e.currency as string);
    const cat = (e.category as string) || 'general';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + converted);
    const [y, m] = String(e.expense_date).split('-');
    byMonth.set(`${y}-${m}`, (byMonth.get(`${y}-${m}`) ?? 0) + converted);
  }
  const spendingByCategory: SpendingSlice[] = Array.from(byCategory.entries())
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const now = new Date();
  const spendingByMonth: SpendingSlice[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { label: MONTHS[d.getMonth()], amount: Math.round(byMonth.get(key) ?? 0) };
  });

  const expenses: GroupExpenseRow[] = (expenseRows ?? []).map((e) => {
    const expensePayers = e.expense_payers as any[];
    const expenseSplits = e.expense_splits as any[];
    const myPaid = expensePayers.find((p) => p.user_id === userId);
    const mySplit = expenseSplits.find((s) => s.user_id === userId);
    const net = Number(myPaid?.amount_paid ?? 0) - Number(mySplit?.amount_owed ?? 0);
    const [, month, day] = String(e.expense_date).split('-').map(Number);
    const firstPayer = expensePayers[0];
    const payerName = !firstPayer ? 'Someone' : firstPayer.user_id === userId ? 'You' : firstPayer.profiles?.full_name ?? 'Someone';
    const currency = (e.currency as string) || 'PKR';
    return {
      id: e.id as string,
      day: String(day),
      mon: MONTHS[(month ?? 1) - 1],
      title: e.description as string,
      sub: `${payerName} paid ${rs(Number(e.amount), currency)}`,
      label: net > 0.5 ? 'you lent' : net < -0.5 ? 'you borrowed' : 'settled',
      amount: Math.round(Math.abs(net)),
      owed: net >= 0,
      category: (e.category as string) || 'general',
      currency,
    };
  });

  return {
    id: group!.id as string,
    name: group!.name as string,
    icon: group!.icon as IconName,
    members,
    totalSpent: Math.round(totalSpent),
    currency: viewerCurrency,
    myNet,
    balances,
    balancesLabel: myNet >= 0 ? 'They owe you' : 'You owe',
    expenses,
    spendingByCategory,
    spendingByMonth,
  };
}

/** Signed balance for one pair within a group: positive = otherUserId owes userId. */
export async function fetchPairBalance(groupId: string, userId: string, otherUserId: string, viewerCurrency: string): Promise<number> {
  const [{ data: expenseRows, error: eErr }, { data: settlementRows, error: sErr }] = await Promise.all([
    supabase.from('expenses').select('currency, expense_payers(user_id, amount_paid), expense_splits(user_id, amount_owed)').eq('group_id', groupId).is('deleted_at', null),
    supabase.from('settlements').select('from_user, to_user, amount, currency').eq('group_id', groupId),
  ]);
  if (eErr) throw eErr;
  if (sErr) throw sErr;

  const currencies = [...(expenseRows ?? []).map((e) => e.currency as string), ...(settlementRows ?? []).map((s) => s.currency as string)];
  const rateMap = await rateMapFor(currencies, viewerCurrency);
  const conv = (amount: number, from: string) => amount * (rateMap[from] ?? 1);

  const payers = (expenseRows ?? []).flatMap((e) => (e.expense_payers as any[]).map((p) => ({ userId: p.user_id as string, amountPaid: conv(Number(p.amount_paid), e.currency as string) })));
  const splits = (expenseRows ?? []).flatMap((e) => (e.expense_splits as any[]).map((s) => ({ userId: s.user_id as string, amountOwed: conv(Number(s.amount_owed), e.currency as string) })));
  const settlements = (settlementRows ?? []).map((s) => ({ fromUser: s.from_user as string, toUser: s.to_user as string, amount: conv(Number(s.amount), s.currency as string) }));
  const nets = netBalances({ payers, splits, settlements });
  const edge = simplifyDebts(nets).find((e) => (e.from === userId && e.to === otherUserId) || (e.from === otherUserId && e.to === userId));
  if (!edge) return 0;
  return edge.from === otherUserId ? edge.amount : -edge.amount;
}

/* --------------------------------------------------------------- CSV export */
export interface ExportExpenseRow {
  date: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  paidBy: string;
  splits: { name: string; amount: number }[];
}

/** Objective (not viewer-relative) rows for CSV export — every payer/split shown, not "you"-framed, in each expense's own currency. */
export async function fetchGroupExpensesForExport(groupId: string): Promise<ExportExpenseRow[]> {
  const { data: rows, error } = await supabase
    .from('expenses')
    .select('description, amount, currency, category, expense_date, expense_payers(amount_paid, profiles(full_name)), expense_splits(amount_owed, profiles(full_name))')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false });
  if (error) throw error;

  return (rows ?? []).map((e) => {
    const payers = e.expense_payers as any[];
    const splits = e.expense_splits as any[];
    return {
      date: e.expense_date as string,
      description: e.description as string,
      category: (e.category as string) || 'general',
      amount: Number(e.amount),
      currency: (e.currency as string) || 'PKR',
      paidBy: payers.map((p) => p.profiles?.full_name || 'Someone').join(', '),
      splits: splits.map((s) => ({ name: s.profiles?.full_name || 'Someone', amount: Number(s.amount_owed) })),
    };
  });
}

/* --------------------------------------------------------- notification prefs */
export async function fetchNotificationSettings(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.from('notification_settings').select('group_id, muted').eq('user_id', userId).not('group_id', 'is', null);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.group_id as string, Boolean(r.muted)]));
}

export async function setGroupMuted(userId: string, groupId: string, muted: boolean): Promise<void> {
  const { error } = await supabase.from('notification_settings').upsert({ user_id: userId, group_id: groupId, muted }, { onConflict: 'user_id,group_id' });
  if (error) throw error;
}

/* --------------------------------------------------------------------- home */
export interface FriendRow {
  person: Person;
  amount: number;
  owed: boolean;
  sub: string;
  groupId: string;
}

export interface HomeSummary {
  friends: FriendRow[];
  totals: { owed: number; owe: number };
  currency: string;
}

export async function fetchHomeSummary(userId: string, viewerCurrency: string): Promise<HomeSummary> {
  const ledgers = await fetchGroupLedgers(userId, viewerCurrency);
  const byCounterparty = new Map<string, { person: Person; amount: number; groups: Set<string>; primaryGroupId: string; primaryAbs: number }>();

  for (const l of ledgers) {
    const peopleById = new Map(l.members.map((p) => [p.id, p]));
    for (const e of simplifyDebts(l.nets)) {
      if (e.from !== userId && e.to !== userId) continue;
      const counterpartyId = e.from === userId ? e.to : e.from;
      const person = peopleById.get(counterpartyId);
      if (!person) continue;
      const signed = e.from === userId ? -e.amount : e.amount; // positive: they owe me
      const cur = byCounterparty.get(counterpartyId) ?? { person, amount: 0, groups: new Set<string>(), primaryGroupId: l.groupId, primaryAbs: 0 };
      cur.amount += signed;
      cur.groups.add(l.groupName);
      if (Math.abs(signed) > cur.primaryAbs) {
        cur.primaryAbs = Math.abs(signed);
        cur.primaryGroupId = l.groupId;
      }
      byCounterparty.set(counterpartyId, cur);
    }
  }

  const friends: FriendRow[] = Array.from(byCounterparty.values())
    .filter((f) => Math.abs(f.amount) > 0.5)
    .map((f) => ({ person: f.person, amount: Math.round(Math.abs(f.amount)), owed: f.amount > 0, sub: Array.from(f.groups).join(' · '), groupId: f.primaryGroupId }))
    .sort((a, b) => b.amount - a.amount);

  const totals = friends.reduce(
    (acc, f) => {
      if (f.owed) acc.owed += f.amount;
      else acc.owe += f.amount;
      return acc;
    },
    { owed: 0, owe: 0 },
  );

  return { friends, totals, currency: viewerCurrency };
}

/* ---------------------------------------------------------- create a group */
export async function findUserByEmail(email: string): Promise<Person | null> {
  const { data, error } = await supabase.rpc('find_user_by_email', { p_email: email.trim().toLowerCase() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id, name: row.full_name || email, avatarUrl: row.avatar_url };
}

/* --------------------------------------------------------- add a friend */
export interface AddFriendResult {
  person: Person;
  /** true when the email has no DutchUp account yet — nothing was written. */
  pending: boolean;
}

/**
 * Adds a friend by email outside of any group. Friendship rows are one-sided
 * (`user_id` = the current user) and written as already-accepted, since the
 * app has no separate request/accept flow yet.
 */
export async function addFriend(userId: string, email: string): Promise<AddFriendResult> {
  const found = await findUserByEmail(email);
  if (!found) {
    return { person: { id: `pending:${email.trim()}`, name: email.trim() }, pending: true };
  }
  if (found.id === userId) throw new Error("You can't add yourself as a friend.");

  const { error } = await supabase.from('friendships').insert({ user_id: userId, friend_id: found.id, status: 'accepted' });
  if (error && error.code !== '23505') throw error; // 23505: already friends — not an error for this flow

  return { person: found, pending: false };
}

export async function createGroup(params: { name: string; icon: IconName; createdBy: string; members: Person[] }): Promise<string> {
  const { data: group, error } = await supabase.from('groups').insert({ name: params.name, icon: params.icon, created_by: params.createdBy }).select('id').single();
  if (error) {
    console.error('createGroup insert failed', error);
    throw error;
  }
  const groupId = group.id as string;

  const others = params.members.filter((p) => p.id !== params.createdBy);
  const rows = [{ group_id: groupId, user_id: params.createdBy, role: 'admin' as const }, ...others.map((p) => ({ group_id: groupId, user_id: p.id, role: 'member' as const }))];
  const { error: memErr } = await supabase.from('group_members').insert(rows);
  if (memErr) throw memErr;

  if (others.length > 0) {
    await supabase.from('activity_log').insert(
      others.map((p) => ({
        group_id: groupId,
        actor_id: params.createdBy,
        action_type: 'member_added',
        payload: { added_user_id: p.id, added_name: p.name },
      })),
    );
  }

  return groupId;
}

/* -------------------------------------------------------------- expenses */
export interface AddExpenseInput {
  groupId: string;
  createdBy: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage' | 'items';
  splits: { userId: string; amountOwed: number; share?: number }[];
  /** Who paid, and how much each paid — must sum to `amount`. Defaults to createdBy paying it all. */
  payers?: { userId: string; amountPaid: number }[];
  recurringRule?: string | null;
  items?: { name: string; price: number; userIds: string[] }[];
}

export async function addExpense(input: AddExpenseInput): Promise<void> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      split_type: input.splitType,
      recurring_rule: input.recurringRule ?? null,
      created_by: input.createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  const expenseId = expense.id as string;

  const payers = input.payers && input.payers.length > 0 ? input.payers : [{ userId: input.createdBy, amountPaid: input.amount }];
  const { error: payerErr } = await supabase
    .from('expense_payers')
    .insert(payers.map((p) => ({ expense_id: expenseId, user_id: p.userId, amount_paid: p.amountPaid })));
  if (payerErr) throw payerErr;

  const { error: splitErr } = await supabase.from('expense_splits').insert(input.splits.map((s) => ({ expense_id: expenseId, user_id: s.userId, amount_owed: s.amountOwed, share: s.share ?? null })));
  if (splitErr) throw splitErr;

  if (input.items && input.items.length > 0) {
    for (const item of input.items) {
      const { data: itemRow, error: itemErr } = await supabase.from('expense_items').insert({ expense_id: expenseId, name: item.name, price: item.price }).select('id').single();
      if (itemErr) throw itemErr;
      const { error: shareErr } = await supabase.from('expense_item_shares').insert(item.userIds.map((userId) => ({ item_id: itemRow.id, user_id: userId })));
      if (shareErr) throw shareErr;
    }
  }

  await supabase.from('activity_log').insert({
    group_id: input.groupId,
    actor_id: input.createdBy,
    action_type: 'expense_added',
    payload: {
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      expense_id: expenseId,
      paid_by: input.createdBy,
      splits: input.splits.map((s) => ({ user_id: s.userId, amount_owed: s.amountOwed })),
    },
  });
}

/* --------------------------------------------------------- expense detail */
export interface ExpenseParticipant {
  person: Person;
  amount: number;
}

export interface ExpenseComment {
  id: string;
  author: Person;
  body: string;
  createdAt: string;
}

export interface ExpenseHistoryEntry {
  id: string;
  editor: Person;
  changes: Record<string, { from: unknown; to: unknown }>;
  editedAt: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  people: Person[];
}

export interface ExpenseDetail {
  id: string;
  groupId: string;
  groupName: string;
  groupIcon: IconName;
  description: string;
  amount: number;
  currency: string;
  category: string;
  splitType: string;
  date: string;
  createdBy: string;
  recurringRule: string | null;
  payers: ExpenseParticipant[];
  splits: ExpenseParticipant[];
  items: ExpenseItem[];
  comments: ExpenseComment[];
  history: ExpenseHistoryEntry[];
  canEdit: boolean;
  canDelete: boolean;
}

export async function fetchExpenseDetail(expenseId: string, userId: string): Promise<ExpenseDetail> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .select('id, group_id, description, amount, currency, category, split_type, expense_date, created_by, recurring_rule, groups(id, name, icon)')
    .eq('id', expenseId)
    .single();
  if (error) throw error;
  const groupId = expense.group_id as string;

  const [
    { data: payerRows, error: pErr },
    { data: splitRows, error: sErr },
    { data: commentRows, error: cErr },
    { data: historyRows, error: hErr },
    { data: itemRows, error: iErr },
    { data: membership },
  ] = await Promise.all([
    supabase.from('expense_payers').select('user_id, amount_paid, profiles(id, full_name, avatar_url)').eq('expense_id', expenseId),
    supabase.from('expense_splits').select('user_id, amount_owed, profiles(id, full_name, avatar_url)').eq('expense_id', expenseId),
    supabase.from('expense_comments').select('id, body, created_at, profiles(id, full_name, avatar_url)').eq('expense_id', expenseId).order('created_at', { ascending: true }),
    supabase.from('expense_edit_history').select('id, changes, edited_at, profiles(id, full_name, avatar_url)').eq('expense_id', expenseId).order('edited_at', { ascending: false }),
    supabase.from('expense_items').select('id, name, price, expense_item_shares(profiles(id, full_name, avatar_url))').eq('expense_id', expenseId).order('created_at', { ascending: true }),
    supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', userId).maybeSingle(),
  ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;
  if (cErr) throw cErr;
  if (hErr) throw hErr;
  if (iErr) throw iErr;

  const isCreator = expense.created_by === userId;
  const isAdmin = (membership as any)?.role === 'admin';
  const group = expense.groups as any;

  return {
    id: expense.id as string,
    groupId,
    groupName: group?.name ?? '',
    groupIcon: (group?.icon as IconName) ?? 'users',
    description: expense.description as string,
    amount: Number(expense.amount),
    currency: (expense.currency as string) || 'PKR',
    category: (expense.category as string) || 'general',
    splitType: expense.split_type as string,
    date: expense.expense_date as string,
    createdBy: expense.created_by as string,
    recurringRule: (expense.recurring_rule as string | null) ?? null,
    payers: (payerRows ?? []).map((p) => ({ person: toPerson(p.profiles as any), amount: Number(p.amount_paid) })),
    splits: (splitRows ?? []).map((s) => ({ person: toPerson(s.profiles as any), amount: Number(s.amount_owed) })),
    items: (itemRows ?? []).map((it) => ({
      id: it.id as string,
      name: it.name as string,
      price: Number(it.price),
      people: (it.expense_item_shares as any[]).map((s) => toPerson(s.profiles)),
    })),
    comments: (commentRows ?? []).map((c) => ({ id: c.id as string, author: toPerson(c.profiles as any), body: c.body as string, createdAt: c.created_at as string })),
    history: (historyRows ?? []).map((h) => ({ id: h.id as string, editor: toPerson(h.profiles as any), changes: h.changes as any, editedAt: h.edited_at as string })),
    canEdit: isCreator,
    canDelete: isCreator || isAdmin,
  };
}

export async function addComment(expenseId: string, userId: string, body: string): Promise<void> {
  const { error } = await supabase.from('expense_comments').insert({ expense_id: expenseId, user_id: userId, body });
  if (error) throw error;
}

export interface UpdateExpenseInput {
  expenseId: string;
  groupId: string;
  editedBy: string;
  description: string;
  amount: number;
  category: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: { userId: string; amountOwed: number; share?: number }[];
  /** Who paid, and how much each paid — must sum to `amount`. */
  payers: { userId: string; amountPaid: number }[];
  previous: { description: string; amount: number; category: string; splits: { userId: string; amountOwed: number }[] };
}

const splitsKey = (splits: { userId: string; amountOwed: number }[]) =>
  splits
    .map((s) => `${s.userId}:${s.amountOwed}`)
    .sort()
    .join(',');

export async function updateExpense(input: UpdateExpenseInput): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ description: input.description, amount: input.amount, category: input.category, split_type: input.splitType })
    .eq('id', input.expenseId);
  if (error) throw error;

  const { error: delErr } = await supabase.from('expense_splits').delete().eq('expense_id', input.expenseId);
  if (delErr) throw delErr;
  const { error: insErr } = await supabase
    .from('expense_splits')
    .insert(input.splits.map((s) => ({ expense_id: input.expenseId, user_id: s.userId, amount_owed: s.amountOwed, share: s.share ?? null })));
  if (insErr) throw insErr;

  const { error: delPayerErr } = await supabase.from('expense_payers').delete().eq('expense_id', input.expenseId);
  if (delPayerErr) throw delPayerErr;
  const { error: payerErr } = await supabase
    .from('expense_payers')
    .insert(input.payers.map((p) => ({ expense_id: input.expenseId, user_id: p.userId, amount_paid: p.amountPaid })));
  if (payerErr) throw payerErr;

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (input.previous.description !== input.description) changes.description = { from: input.previous.description, to: input.description };
  if (input.previous.amount !== input.amount) changes.amount = { from: input.previous.amount, to: input.amount };
  if (input.previous.category !== input.category) changes.category = { from: input.previous.category, to: input.category };
  if (splitsKey(input.previous.splits) !== splitsKey(input.splits)) changes.split = { from: 'previous split', to: 'updated split' };

  if (Object.keys(changes).length > 0) {
    await supabase.from('expense_edit_history').insert({ expense_id: input.expenseId, edited_by: input.editedBy, changes });
    await supabase.from('activity_log').insert({
      group_id: input.groupId,
      actor_id: input.editedBy,
      action_type: 'expense_edited',
      payload: { description: input.description, expense_id: input.expenseId },
    });
  }
}

export async function softDeleteExpense(expenseId: string, groupId: string, userId: string, description: string): Promise<void> {
  const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', expenseId);
  if (error) throw error;
  await supabase.from('activity_log').insert({
    group_id: groupId,
    actor_id: userId,
    action_type: 'expense_deleted',
    payload: { description },
  });
}

/* ------------------------------------------------------------ settlements */
export interface SettleInput {
  groupId: string;
  fromUser: string;
  toUser: string;
  toName: string;
  amount: number;
  currency: string;
  method: string;
  note?: string;
}

export async function settleUp(input: SettleInput): Promise<void> {
  const method = input.method.toLowerCase();
  const { error } = await supabase.from('settlements').insert({
    group_id: input.groupId,
    from_user: input.fromUser,
    to_user: input.toUser,
    amount: input.amount,
    currency: input.currency,
    method,
    created_by: input.fromUser,
  });
  if (error) throw error;

  await supabase.from('activity_log').insert({
    group_id: input.groupId,
    actor_id: input.fromUser,
    action_type: 'settlement',
    payload: { amount: input.amount, currency: input.currency, method, to_user_id: input.toUser, to_name: input.toName, note: input.note ?? null },
  });
}

/* --------------------------------------------------------------- activity */
export type ActivityBadge = 'plus' | 'check' | 'user-plus' | 'pencil' | 'x';
export interface ActivityItem {
  actor: Person;
  text: string;
  time: string;
  effect?: string;
  tone?: 'red' | 'green' | 'muted';
  badge: ActivityBadge;
}
export interface ActivitySection {
  title: string;
  items: ActivityItem[];
}

function sectionTitle(d: Date, now: Date): string {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Earlier this week';
  return 'Earlier';
}

function formatTime(d: Date, now: Date, title: string): string {
  if (title === 'Today') {
    const diffHrs = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 3600000));
    if (diffHrs < 1) return 'Just now';
    return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`;
  }
  if (title === 'Yesterday') return 'Yesterday';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export async function fetchActivity(userId: string): Promise<ActivitySection[]> {
  const { data: myMemberships, error } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
  if (error) throw error;
  const groupIds = Array.from(new Set((myMemberships ?? []).map((r) => r.group_id as string)));
  if (groupIds.length === 0) return [];

  const { data: rows, error: aErr } = await supabase
    .from('activity_log')
    .select('id, actor_id, action_type, payload, created_at, groups(name), profiles(id, full_name, avatar_url)')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(100);
  if (aErr) throw aErr;

  const now = new Date();
  const withDates = (rows ?? []).map((r) => {
    const actor = toPerson(r.profiles as any);
    const isMe = r.actor_id === userId;
    const actorLabel = isMe ? 'You' : actor.name;
    const groupName = (r.groups as any)?.name ?? 'a group';
    const payload = r.payload as any;
    const date = new Date(r.created_at as string);
    const currency = (payload.currency as string | undefined) || 'PKR';

    let text = `**${actorLabel}** updated **${groupName}**`;
    let effect: string | undefined;
    let tone: ActivityItem['tone'] = 'muted';
    let badge: ActivityBadge = 'plus';

    if (r.action_type === 'expense_added') {
      text = `**${actorLabel}** added "${payload.description}" to **${groupName}**`;
      badge = 'plus';
      const mySplit = (payload.splits as any[] | undefined)?.find((s) => s.user_id === userId);
      const iPaid = payload.paid_by === userId;
      const myNet = (iPaid ? Number(payload.amount) : 0) - Number(mySplit?.amount_owed ?? 0);
      if (myNet > 0.5) {
        effect = `You lent ${rs(myNet, currency)}`;
        tone = 'green';
      } else if (myNet < -0.5) {
        effect = `You borrowed ${rs(-myNet, currency)}`;
        tone = 'red';
      }
    } else if (r.action_type === 'settlement') {
      const amount = Number(payload.amount);
      const toName = payload.to_name ?? 'someone';
      badge = 'check';
      if (isMe) {
        text = `**You** settled up with **${toName}**`;
        effect = `You paid ${rs(amount, currency)}${payload.method ? ` · ${cap(payload.method)}` : ''}`;
        tone = 'muted';
      } else if (payload.to_user_id === userId) {
        text = `**${actorLabel}** settled up with you`;
        effect = `You received ${rs(amount, currency)}${payload.method ? ` · ${cap(payload.method)}` : ''}`;
        tone = 'green';
      } else {
        text = `**${actorLabel}** settled up with **${toName}**`;
        tone = 'muted';
      }
    } else if (r.action_type === 'member_added') {
      text = `**${actorLabel}** added **${payload.added_name}** to **${groupName}**`;
      tone = 'green';
      badge = 'user-plus';
    } else if (r.action_type === 'expense_edited') {
      text = `**${actorLabel}** edited "${payload.description}" in **${groupName}**`;
      tone = 'muted';
      badge = 'pencil';
    } else if (r.action_type === 'expense_deleted') {
      text = `**${actorLabel}** deleted "${payload.description}" from **${groupName}**`;
      tone = 'muted';
      badge = 'x';
    }

    return { actor, text, time: '', effect, tone, badge, date };
  });

  const order = ['Today', 'Yesterday', 'Earlier this week', 'Earlier'];
  const buckets = new Map<string, ActivityItem[]>();
  for (const it of withDates) {
    const title = sectionTitle(it.date, now);
    const item: ActivityItem = { actor: it.actor, text: it.text, effect: it.effect, tone: it.tone, badge: it.badge, time: formatTime(it.date, now, title) };
    if (!buckets.has(title)) buckets.set(title, []);
    buckets.get(title)!.push(item);
  }
  return order.filter((t) => buckets.has(t)).map((t) => ({ title: t, items: buckets.get(t)! }));
}
