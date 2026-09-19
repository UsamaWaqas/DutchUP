/**
 * Pure balance math — no I/O. A user's "net" is positive when they're owed money
 * overall and negative when they owe money overall.
 */

export interface BalanceInput {
  payers: { userId: string; amountPaid: number }[];
  splits: { userId: string; amountOwed: number }[];
  settlements: { fromUser: string; toUser: string; amount: number }[];
}

export function netBalances({ payers, splits, settlements }: BalanceInput): Record<string, number> {
  const nets: Record<string, number> = {};
  const add = (userId: string, delta: number) => {
    nets[userId] = (nets[userId] ?? 0) + delta;
  };
  for (const p of payers) add(p.userId, p.amountPaid);
  for (const s of splits) add(s.userId, -s.amountOwed);
  // A settlement from A to B reduces what A owes (or increases what A is owed) and
  // reduces what B is owed (or increases what B owes) by the same amount.
  for (const s of settlements) {
    add(s.fromUser, s.amount);
    add(s.toUser, -s.amount);
  }
  return nets;
}

export interface DebtEdge {
  from: string;
  to: string;
  amount: number;
}

/** Greedy min-transaction settlement: match the biggest debtor against the biggest creditor. */
export function simplifyDebts(nets: Record<string, number>): DebtEdge[] {
  const EPSILON = 0.005;
  const creditors = Object.entries(nets)
    .filter(([, n]) => n > EPSILON)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(nets)
    .filter(([, n]) => n < -EPSILON)
    .map(([userId, amount]) => ({ userId, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const edges: DebtEdge[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.amount, d.amount);
    if (amount > EPSILON) edges.push({ from: d.userId, to: c.userId, amount: Math.round(amount) });
    c.amount -= amount;
    d.amount -= amount;
    if (c.amount <= EPSILON) ci++;
    if (d.amount <= EPSILON) di++;
  }
  return edges;
}
