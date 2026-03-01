// src/services/balance.service.ts
import { query } from '../config/database';
import { Balance, BalanceSummary } from '../../../shared/types';

interface RawBalance {
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  from_avatar: string | null;
  to_avatar: string | null;
  amount: number;
}

/**
 * Core balance calculation engine.
 * 
 * Algorithm:
 * 1. For each expense, the payer is owed money by all splitters
 * 2. Net each person's total owed/owing across all expenses
 * 3. Minimize transactions using greedy algorithm (creditors <-> debtors)
 */
export async function getGroupBalances(
  groupId: string,
  currentUserId?: string
): Promise<BalanceSummary> {
  // Get all unsettled splits with payer info
  const rawDebts = await query<{
    debtor_id: string;
    creditor_id: string;
    amount: string;
    debtor_name: string;
    creditor_name: string;
    debtor_avatar: string | null;
    creditor_avatar: string | null;
  }>(
    `SELECT
      es.user_id as debtor_id,
      e.paid_by as creditor_id,
      es.amount::text,
      du.name as debtor_name,
      cu.name as creditor_name,
      du.avatar_url as debtor_avatar,
      cu.avatar_url as creditor_avatar
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN users du ON du.id = es.user_id
    JOIN users cu ON cu.id = e.paid_by
    WHERE e.group_id = $1
      AND e.deleted_at IS NULL
      AND es.settled = FALSE
      AND es.user_id != e.paid_by`,
    [groupId]
  );

  // Build net balance map: user -> net amount (positive = owed TO user)
  const netBalances = new Map<string, number>();
  const userInfo = new Map<string, { name: string; avatar_url: string | null }>();

  for (const debt of rawDebts) {
    const amount = parseFloat(debt.amount);

    // Debtor owes this amount
    netBalances.set(
      debt.debtor_id,
      (netBalances.get(debt.debtor_id) || 0) - amount
    );

    // Creditor is owed this amount
    netBalances.set(
      debt.creditor_id,
      (netBalances.get(debt.creditor_id) || 0) + amount
    );

    userInfo.set(debt.debtor_id, {
      name: debt.debtor_name,
      avatar_url: debt.debtor_avatar,
    });
    userInfo.set(debt.creditor_id, {
      name: debt.creditor_name,
      avatar_url: debt.creditor_avatar,
    });
  }

  // Minimize transactions using greedy creditor/debtor matching
  const optimizedTransactions = minimizeTransactions(netBalances, userInfo);

  // Get pending settlements
  const settlements = await query(
    `SELECT s.*, 
      fu.name as from_name, fu.avatar_url as from_avatar,
      tu.name as to_name, tu.avatar_url as to_avatar
     FROM settlements s
     JOIN users fu ON fu.id = s.from_user_id
     JOIN users tu ON tu.id = s.to_user_id
     WHERE s.group_id = $1 AND s.status = 'pending'
     ORDER BY s.created_at DESC`,
    [groupId]
  );

  // Your personal balance
  const yourBalance = currentUserId
    ? netBalances.get(currentUserId) || 0
    : 0;

  return {
    group_id: groupId,
    balances: optimizedTransactions,
    settlements: settlements as BalanceSummary['settlements'],
    your_balance: parseFloat(yourBalance.toFixed(2)),
  };
}

/**
 * Greedy algorithm to minimize number of transactions.
 * O(n log n) — sorts creditors and debtors, matches greedily.
 */
function minimizeTransactions(
  netBalances: Map<string, number>,
  userInfo: Map<string, { name: string; avatar_url: string | null }>
): Balance[] {
  const creditors: Array<{ id: string; amount: number }> = [];
  const debtors: Array<{ id: string; amount: number }> = [];

  for (const [userId, balance] of netBalances.entries()) {
    const rounded = parseFloat(balance.toFixed(2));
    if (Math.abs(rounded) < 0.01) continue; // ignore dust amounts

    if (rounded > 0) {
      creditors.push({ id: userId, amount: rounded });
    } else {
      debtors.push({ id: userId, amount: Math.abs(rounded) });
    }
  }

  // Sort descending for greedy matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: Balance[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const settleAmount = Math.min(creditor.amount, debtor.amount);

    if (settleAmount > 0.01) {
      const credInfo = userInfo.get(creditor.id);
      const debtInfo = userInfo.get(debtor.id);

      transactions.push({
        from_user_id: debtor.id,
        to_user_id: creditor.id,
        amount: parseFloat(settleAmount.toFixed(2)),
        from_user: {
          id: debtor.id,
          name: debtInfo?.name || 'Unknown',
          avatar_url: debtInfo?.avatar_url || undefined,
          email: '',
          created_at: '',
        },
        to_user: {
          id: creditor.id,
          name: credInfo?.name || 'Unknown',
          avatar_url: credInfo?.avatar_url || undefined,
          email: '',
          created_at: '',
        },
      });
    }

    creditor.amount -= settleAmount;
    debtor.amount -= settleAmount;

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return transactions;
}

export async function getUserGroupBalance(
  groupId: string,
  userId: string
): Promise<number> {
  const summary = await getGroupBalances(groupId, userId);
  return summary.your_balance;
}
