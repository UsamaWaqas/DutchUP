-- DutchUp — Phase 1 schema (Auth, Friends & Groups, Expenses & Splits, Settlements, Activity feed).
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query) on a fresh project.
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
-- Mirrors auth.users; one row per app user, created automatically on signup.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  default_currency text not null default 'PKR',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default 'users',
  cover_photo_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- friendships
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- --------------------------------------------------------------- expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'PKR',
  category text not null default 'general',
  expense_date date not null default current_date,
  receipt_url text,
  split_type text not null default 'equal' check (split_type in ('equal', 'exact', 'percentage', 'shares', 'items')),
  recurring_rule text check (recurring_rule in ('weekly', 'monthly', 'yearly', 'fortnightly')),
  recurring_parent_id uuid references public.expenses (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-run-safe for projects that already had `expenses` before this column existed.
alter table public.expenses add column if not exists recurring_parent_id uuid references public.expenses (id) on delete set null;
-- Re-run-safe: widen the split_type check for projects created before 'items' was added.
alter table public.expenses drop constraint if exists expenses_split_type_check;
alter table public.expenses add constraint expenses_split_type_check check (split_type in ('equal', 'exact', 'percentage', 'shares', 'items'));

create table if not exists public.expense_payers (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount_paid numeric(12, 2) not null check (amount_paid > 0),
  primary key (expense_id, user_id)
);

create table if not exists public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount_owed numeric(12, 2) not null,
  share numeric,
  primary key (expense_id, user_id)
);

-- Itemized splitting: line items on a receipt, each split among the people assigned to it.
create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null check (price > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.expense_item_shares (
  item_id uuid not null references public.expense_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  primary key (item_id, user_id)
);

create table if not exists public.expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_edit_history (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  edited_by uuid not null references public.profiles (id),
  changes jsonb not null,
  edited_at timestamptz not null default now()
);

-- ------------------------------------------------------------- settlements
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'PKR',
  method text not null default 'cash',
  settled_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  check (from_user <> to_user)
);

-- Re-run-safe for projects that already had `settlements` before this column existed.
alter table public.settlements add column if not exists currency text not null default 'PKR';

-- ----------------------------------------------------------------- activity
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  action_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------ notification prefs
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  muted boolean not null default false,
  notification_types text[] not null default '{}',
  unique (user_id, group_id)
);

-- ------------------------------------------------------------- updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------- helper functions
-- SECURITY DEFINER + no RLS-recursion: policies call these instead of
-- querying group_members from within a group_members policy directly.
-- language plpgsql (not sql): plain SQL functions are eligible for inlining by the
-- planner, which can re-expose the guarded table's own RLS policy inside these
-- helpers and trip Postgres's "infinite recursion detected in policy" guard.
-- plpgsql functions are opaque to the planner, so they can't be inlined that way.
-- `set row_security = off`: belt-and-suspenders — SECURITY DEFINER alone doesn't
-- reliably bypass RLS for tables the definer doesn't literally own on every
-- Postgres/Supabase setup, and expenses_select -> expense_payers_select ->
-- can_access_expense -> expenses is a genuine cycle if RLS stays on here.
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
end;
$$;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and role = 'admin'
  );
end;
$$;

-- Wraps the expenses -> expense_payers/expense_splits direction the same way
-- can_access_expense wraps the reverse direction. expenses_select used to reach
-- into those tables with a raw (non-definer) subquery, which stayed subject to
-- their own RLS and re-entered can_access_expense -> expenses -> ... in a loop.
-- Every cross-table hop in this cycle now crosses a SECURITY DEFINER boundary,
-- matching the pattern that already works for group_members <-> is_group_member.
create or replace function public.is_expense_participant(p_expense_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
set row_security = off
as $$
begin
  return exists (select 1 from public.expense_payers where expense_id = p_expense_id and user_id = p_user_id)
      or exists (select 1 from public.expense_splits where expense_id = p_expense_id and user_id = p_user_id);
end;
$$;

create or replace function public.can_access_expense(p_expense_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and (
        e.created_by = p_user_id
        or (e.group_id is not null and public.is_group_member(e.group_id, p_user_id))
        or public.is_expense_participant(e.id, p_user_id)
      )
  );
end;
$$;

-- --------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.friendships enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_splits enable row level security;
alter table public.expense_items enable row level security;
alter table public.expense_item_shares enable row level security;
alter table public.expense_comments enable row level security;
alter table public.expense_edit_history enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_log enable row level security;
alter table public.notification_settings enable row level security;

-- profiles: see yourself, and anyone you share a group with.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = profiles.id
    )
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: members, plus the creator (who isn't a group_members row yet at the
-- instant createGroup()'s insert().select() reads back the just-created row).
drop policy if exists "groups_select" on public.groups;
create policy "groups_select" on public.groups for select
  using (created_by = auth.uid() or public.is_group_member(id, auth.uid()));

drop policy if exists "groups_insert" on public.groups;
create policy "groups_insert" on public.groups for insert
  with check (created_by = auth.uid());

drop policy if exists "groups_update" on public.groups;
create policy "groups_update" on public.groups for update
  using (public.is_group_admin(id, auth.uid()));

drop policy if exists "groups_delete" on public.groups;
create policy "groups_delete" on public.groups for delete
  using (public.is_group_admin(id, auth.uid()));

-- group_members: members can see the roster; joining/leaving/admin-add/remove.
drop policy if exists "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));

-- The `exists ... groups` clause matters: createGroup() inserts the creator's
-- admin row and any invited members in one multi-row statement. Every row's
-- WITH CHECK runs against the snapshot taken before that statement started, so
-- is_group_admin() (reading group_members) can't see the creator's own row
-- being inserted in that same statement. Checking groups.created_by instead
-- reads a table that was already committed by createGroup()'s prior, separate
-- `groups` insert, so it's visible regardless of same-statement ordering.
drop policy if exists "group_members_insert" on public.group_members;
create policy "group_members_insert" on public.group_members for insert
  with check (
    user_id = auth.uid()
    or public.is_group_admin(group_id, auth.uid())
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

drop policy if exists "group_members_update" on public.group_members;
create policy "group_members_update" on public.group_members for update
  using (public.is_group_admin(group_id, auth.uid()));

drop policy if exists "group_members_delete" on public.group_members;
create policy "group_members_delete" on public.group_members for delete
  using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- group_invites: any member can create a link; members can see/revoke theirs.
drop policy if exists "group_invites_select" on public.group_invites;
create policy "group_invites_select" on public.group_invites for select
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_invites_insert" on public.group_invites;
create policy "group_invites_insert" on public.group_invites for insert
  with check (public.is_group_member(group_id, auth.uid()) and created_by = auth.uid());

drop policy if exists "group_invites_delete" on public.group_invites;
create policy "group_invites_delete" on public.group_invites for delete
  using (created_by = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- friendships: only the two people involved.
drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select" on public.friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friendships_insert" on public.friendships;
create policy "friendships_insert" on public.friendships for insert
  with check (user_id = auth.uid());

drop policy if exists "friendships_update" on public.friendships;
create policy "friendships_update" on public.friendships for update
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friendships_delete" on public.friendships;
create policy "friendships_delete" on public.friendships for delete
  using (user_id = auth.uid() or friend_id = auth.uid());

-- expenses: group members, participants, or the creator.
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses for select
  using (
    created_by = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
    or public.is_expense_participant(id, auth.uid())
  );

drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses for insert
  with check (created_by = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses for update
  using (created_by = auth.uid() or (group_id is not null and public.is_group_admin(group_id, auth.uid())));

drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses for delete
  using (created_by = auth.uid() or (group_id is not null and public.is_group_admin(group_id, auth.uid())));

-- expense_payers / expense_splits / comments / history: follow the parent expense.
drop policy if exists "expense_payers_select" on public.expense_payers;
create policy "expense_payers_select" on public.expense_payers for select
  using (public.can_access_expense(expense_id, auth.uid()));

drop policy if exists "expense_payers_write" on public.expense_payers;
create policy "expense_payers_write" on public.expense_payers for all
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.created_by = auth.uid()))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and e.created_by = auth.uid()));

drop policy if exists "expense_splits_select" on public.expense_splits;
create policy "expense_splits_select" on public.expense_splits for select
  using (public.can_access_expense(expense_id, auth.uid()));

drop policy if exists "expense_splits_write" on public.expense_splits;
create policy "expense_splits_write" on public.expense_splits for all
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.created_by = auth.uid()))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and e.created_by = auth.uid()));

drop policy if exists "expense_items_select" on public.expense_items;
create policy "expense_items_select" on public.expense_items for select
  using (public.can_access_expense(expense_id, auth.uid()));

drop policy if exists "expense_items_write" on public.expense_items;
create policy "expense_items_write" on public.expense_items for all
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.created_by = auth.uid()))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and e.created_by = auth.uid()));

drop policy if exists "expense_item_shares_select" on public.expense_item_shares;
create policy "expense_item_shares_select" on public.expense_item_shares for select
  using (exists (select 1 from public.expense_items i where i.id = item_id and public.can_access_expense(i.expense_id, auth.uid())));

drop policy if exists "expense_item_shares_write" on public.expense_item_shares;
create policy "expense_item_shares_write" on public.expense_item_shares for all
  using (exists (select 1 from public.expense_items i join public.expenses e on e.id = i.expense_id where i.id = item_id and e.created_by = auth.uid()))
  with check (exists (select 1 from public.expense_items i join public.expenses e on e.id = i.expense_id where i.id = item_id and e.created_by = auth.uid()));

drop policy if exists "expense_comments_select" on public.expense_comments;
create policy "expense_comments_select" on public.expense_comments for select
  using (public.can_access_expense(expense_id, auth.uid()));

drop policy if exists "expense_comments_insert" on public.expense_comments;
create policy "expense_comments_insert" on public.expense_comments for insert
  with check (user_id = auth.uid() and public.can_access_expense(expense_id, auth.uid()));

drop policy if exists "expense_comments_delete" on public.expense_comments;
create policy "expense_comments_delete" on public.expense_comments for delete
  using (user_id = auth.uid());

drop policy if exists "expense_edit_history_select" on public.expense_edit_history;
create policy "expense_edit_history_select" on public.expense_edit_history for select
  using (public.can_access_expense(expense_id, auth.uid()));

drop policy if exists "expense_edit_history_insert" on public.expense_edit_history;
create policy "expense_edit_history_insert" on public.expense_edit_history for insert
  with check (edited_by = auth.uid() and public.can_access_expense(expense_id, auth.uid()));

-- settlements: either side of the payment, or the group.
drop policy if exists "settlements_select" on public.settlements;
create policy "settlements_select" on public.settlements for select
  using (from_user = auth.uid() or to_user = auth.uid() or (group_id is not null and public.is_group_member(group_id, auth.uid())));

drop policy if exists "settlements_insert" on public.settlements;
create policy "settlements_insert" on public.settlements for insert
  with check (created_by = auth.uid() and (from_user = auth.uid() or to_user = auth.uid()));

-- activity_log: group members only; written by the acting user.
drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log for select
  using (group_id is not null and public.is_group_member(group_id, auth.uid()));

drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log for insert
  with check (actor_id = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));

-- notification_settings: private to each user.
drop policy if exists "notification_settings_all" on public.notification_settings;
create policy "notification_settings_all" on public.notification_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------ invite lookup
-- Exact-email lookup so a group creator can add an existing user before they
-- share any group (profiles_select's RLS wouldn't otherwise allow it). Only
-- ever returns a single row for an exact match — never a searchable list.
create or replace function public.find_user_by_email(p_email text)
returns table (id uuid, full_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = lower(p_email)
  limit 1;
$$;

revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to authenticated;
