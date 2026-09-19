# DutchUp (React Native · Expo SDK 57)

Splitwise-style expense splitting. The original 9 screens came from the approved "Delft" design; Phase 1
(auth/groups/expenses/balances/settle up/activity), Phase 2 (categories, comments, edit history, CSV export,
recurring expenses, notification-mute settings), and most of Phase 3 (itemized splitting, live-rate currency
conversion, spending charts — OCR receipt scanning traded out, see Notes) from `Splitwise_Clone_Blueprint_Updated.docx`
are wired to real Supabase data. See Notes below for what's simplified or still a placeholder.

- **Expo SDK 57** (latest at build time) · React Native 0.86 · React 19.2 · Expo Router 57 · TypeScript
- Fonts: Instrument Serif + Manrope via `@expo-google-fonts/*` (bundled, no network at runtime)
- Icons and the Delft-tile pattern are drawn with `react-native-svg` (no icon library needed)

## Run

```bash
npm install
cp .env.example .env    # fill in your Supabase project URL + anon key
npx expo start --dev-client   # or: npm run android / npm run ios (dev client build)
npm run web             # quick browser preview
npm run typecheck
```

## Backend (Supabase)

1. Create a free project at supabase.com.
2. Project Settings → API → copy the **Project URL** and **anon public** key into `.env` (never the `service_role` key).
3. SQL Editor → New query → paste and run `supabase/schema.sql`. It creates every table (profiles, groups,
   group_members, group_invites, friendships, expenses, expense_payers, expense_splits, expense_items,
   expense_item_shares, expense_comments, expense_edit_history, settlements, activity_log, notification_settings),
   a trigger that creates a `profiles` row on signup, and row-level-security policies scoping every table to the
   signed-in user's own groups/expenses. It's written to be safe to re-run — always re-run it after pulling changes
   that touch `supabase/schema.sql`, even on a project you set up before.
4. Auth → URL Configuration → add `dutchup://reset-password` as a redirect URL (needed for the forgot-password flow).

## Structure

```
src/
  theme.ts                 colours, fonts, radii (design tokens)
  components/
    Text.tsx               T (CSS-like text props) + Rich (**bold** runs)
    Icon.tsx, iconData.ts  stroke icons
    Motif.tsx              Delft-tile pattern (explicit shapes, fades from a corner)
    Avatar.tsx             Avatar, AvatarStack — generic Person-shaped, colours hashed from user id
    Controls.tsx           Button, IconButton, Chip, Tabs, Segmented, Field, SearchField, Checkbox
    Layout.tsx             Screen, TopBar, LargeTitle, SectionLabel, Card, Hero, MoneyBig, Tile, TabBar
  lib/
    supabase.ts            Supabase client (reads EXPO_PUBLIC_SUPABASE_* env vars)
    auth-context.tsx       AuthProvider / useAuth() — session, profile, signUp/signIn/signOut/reset
    person.ts              Person shape + deterministic avatar colours/initials
    format.ts              rs() currency formatter
    categories.ts          expense category list + icons
    currencies.ts          curated currency list + symbolFor()
    exchangeRates.ts       live rate lookup (open.er-api.com), cached, degrades to 1:1 if unreachable
    balances.ts            pure debt math: netBalances(), simplifyDebts() — currency-agnostic on purpose
    queries.ts             every Supabase read/write the screens use
    csv.ts                 CSV building + platform export (browser download / native share sheet)
  app/                     Expo Router routes
    _layout.tsx            fonts, splash, AuthProvider, protected-route redirect, stack
    index.tsx              Welcome / log in (real Supabase auth)
    signup.tsx             Create account
    forgot-password.tsx    Send password-reset email
    reset-password.tsx     Deep-link landing screen for the reset email, sets new password
    (tabs)/home.tsx        Home — net balance + friends list, real data via fetchHomeSummary
    (tabs)/groups.tsx      Groups list, real data via fetchGroups
    (tabs)/activity.tsx    Activity feed, real data via fetchActivity
    group.tsx              Group detail — balances, spending charts, ledger, "more" menu (CSV export / notification settings)
    expense.tsx            Expense detail — split breakdown, receipt items, edit history, comments
    new-group.tsx          New group — add people by exact-email match
    settle.tsx             Settle up — direction (owe / owed) resolved from the real pair balance
    add-expense.tsx        Add/edit expense — ?mode=equal|exact|percent|items, ?expenseId= for editing
    notifications.tsx      Per-group mute toggles (notification_settings table)
```

## Notes

- DutchUp only **records** payments. The Easypaisa / JazzCash / bank rows on Settle up are UI placeholders: wire them to
  `Linking.openURL(...)` / `expo-clipboard` when you add real integrations.
- Auth (email/password signup, login, forgot/reset password) is wired to Supabase. Google sign-in is a UI placeholder
  until an OAuth client is configured.
- Home/Groups/Group detail/New group/Add expense/Settle up/Activity all read and write real Supabase data
  (`src/lib/queries.ts`, balance math in `src/lib/balances.ts`). Adding people to a new group is by exact-email
  match (`find_user_by_email` in `supabase/schema.sql` — re-run the schema after pulling this change); an unmatched
  email is shown as "invited" for that session only, since there's no pending-invite table yet. Expenses always have
  a single payer (the current user) — "Multiple payers" stays a UI placeholder. Screens refetch on focus; there's no
  realtime subscription, so a change made on another device needs a re-visit to the screen to show up.
- **Recurring expenses** are a client-side catch-up, not a real cron: opening a group checks its recurring expense
  templates and materializes any past-due occurrences right there. This only advances when *the template's own
  creator* opens the group — every insert (`expenses`/`expense_payers`/`expense_splits`) is RLS-gated to
  `created_by = auth.uid()`, so no other member's client is able to generate someone else's recurring expense. If
  you need occurrences to appear on schedule regardless of who opens the app, that needs a real `pg_cron` job or a
  Supabase Edge Function on a schedule — not set up here.
- **CSV export** (group detail → "…" → Export expenses) shares a CSV as plain text via the OS share sheet on
  native (`Share.share`), or downloads a real `.csv` file on web. Native isn't a true `.csv` file attachment —
  that needs `expo-sharing` + `expo-file-system`, both native modules that would require rebuilding the dev client.
- **Push notifications** are settings-only: the "Notification settings" screen mutes/unmutes a group
  (`notification_settings` table), but nothing sends an actual push. That needs `expo-notifications` (native module,
  dev-client rebuild) plus a server-side sender — a Supabase Edge Function triggered by a Database Webhook on
  `activity_log` inserts, checking `notification_settings` before calling Expo's push API. None of that is deployed;
  the Activity feed is the only in-app notification surface for now.
- **OCR receipt scanning** was traded out for **itemized splitting** (Add Expense → "Items" mode): manually add a
  receipt's line items and assign each to whoever's splitting it — no camera, no cloud OCR (both need a native
  module rebuild and a keyed API this environment can't provide). Itemized expenses are create-only — editing one
  afterwards isn't supported, same scope cut as "Repeats."
- **Currency conversion** is real: pick a currency per expense (`src/lib/currencies.ts`), and every aggregate figure
  (Home totals, a group's hero balance/total spent/spending charts) is converted to the viewer's own
  `profiles.default_currency` via live rates (`src/lib/exchangeRates.ts`, cached 1 hour, degrades to a 1:1 rate if
  the API is unreachable — never hard-fails a balance screen over a third-party outage). A single expense's own
  ledger row and detail screen always show its own original currency, unconverted — an expense's payers and splits
  never mix currencies, so there's nothing to convert to display it correctly on its own.
- **Spending charts** (Group detail) are plain `View`-based bars, not `react-native-svg` — simpler than real SVG for
  flat rectangles and needs no extra dependency. Both are single-series (one accent colour; each bar is already
  text-labeled by category or month, so color isn't carrying identity) — by category, and by month for the last 6
  months.
- Every screen gets real top **and** bottom safe-area padding (`Screen` in `src/components/Layout.tsx`); Stack
  pushes and tab switches are animated (`slide_from_right` / `fade` respectively, both in the relevant `_layout.tsx`).
- The top 52 px of each screen is reserved (or the device safe-area inset, whichever is larger), as in the design.
