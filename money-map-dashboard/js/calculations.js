// calculations.js — pure functions, no DOM. Tested standalone before wiring to UI.

export function monthKey(dateStr) { return dateStr.slice(0, 7); }
export function todayStr() { return new Date().toISOString().slice(0, 10); }
export function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ---------- Budget Health (expense categories) — thresholds standardized 74/89/100 ----------
export function categorySpending(transactions, month, categoryId) {
  let total = 0;
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'expense' && t.category === categoryId) total += t.amount;
    if (t.type === 'refund' && t.category === categoryId) total -= t.amount;
  }
  return total;
}
export function categoryStatus(spending, budget) {
  if (!budget) return spending > 0 ? { label: 'Unplanned spending', level: 'amber', pct: null } : { label: 'No budget set', level: 'gray', pct: null };
  const pct = (spending / budget) * 100;
  if (pct > 100) return { label: 'Over plan', level: 'red', pct };
  if (pct >= 90) return { label: 'Needs attention', level: 'red', pct };
  if (pct >= 75) return { label: 'Watch', level: 'amber', pct };
  return { label: 'On track', level: 'green', pct };
}

// ---------- Goals & Buffers ----------
// FIX vs. v2: progress is cumulative all-time (+ an optional starting amount), not reset every month.
// A Safety Buffer or Personal Goal builds over months; resetting it to "Not started" each month was wrong.
export function goalsBufferAllTimeContributed(transactions, itemId) {
  let total = 0;
  for (const t of transactions) {
    if (t.type === 'savings' && t.goalsBufferId === itemId) total += t.amount;
  }
  return total;
}
export function goalsBufferMonthContributed(transactions, month, itemId) {
  let total = 0;
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'savings' && t.goalsBufferId === itemId) total += t.amount;
  }
  return total;
}
export function goalsBufferCurrentAmount(transactions, item) {
  return (item.startingAmount || 0) + goalsBufferAllTimeContributed(transactions, item.id);
}
export function goalsBufferStatus(currentAmount, targetAmount) {
  if (!targetAmount) return { label: 'No target set', level: 'gray', pct: null };
  if (currentAmount <= 0) return { label: 'Not started', level: 'gray', pct: 0 };
  const pct = (currentAmount / targetAmount) * 100;
  if (currentAmount >= targetAmount) return { label: 'Target met', level: 'green', pct };
  return { label: 'In progress', level: 'blue', pct };
}
export function suggestedMonthlyContribution(currentAmount, targetAmount, targetDateStr) {
  if (!targetDateStr || !targetAmount) return null;
  const today = new Date();
  const target = new Date(targetDateStr);
  let months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
  if (months <= 0) months = 1; // due this month or overdue: show as a lump figure, not divide-by-zero
  const remaining = Math.max(targetAmount - currentAmount, 0);
  return remaining / months;
}

// ---------- Income Sources, Events, Paycheck Plan ----------
export function incomeReceivedFromSource(transactions, month, sourceId) {
  let total = 0;
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income' && t.source === sourceId) total += t.amount;
  }
  return total;
}
export function allocationsForEvent(paycheckPlans, incomeEventId) {
  return paycheckPlans.filter(p => p.incomeEventId === incomeEventId);
}
export function totalAllocated(paycheckPlans, incomeEventId) {
  return allocationsForEvent(paycheckPlans, incomeEventId).reduce((sum, p) => sum + p.amount, 0);
}
export function unassignedMoney(incomeEvent, paycheckPlans) {
  const base = incomeEvent.actualAmount != null ? incomeEvent.actualAmount : incomeEvent.expectedAmount;
  return base - totalAllocated(paycheckPlans, incomeEvent.id);
}

// ---------- Bill Command Center ----------
export function addPeriod(dateStr, frequency) {
  const d = new Date(dateStr + 'T00:00:00');
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'annual': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}
export function nextDueDate(bill) {
  let candidate = bill.anchorDate;
  let guard = 0;
  while (bill.lastPaidDate && candidate <= bill.lastPaidDate && guard < 60) {
    candidate = addPeriod(candidate, bill.frequency);
    guard++;
  }
  return candidate;
}
export function daysUntil(dateStr, today) {
  const d1 = new Date(today + 'T00:00:00');
  const d2 = new Date(dateStr + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}
export function billStatus(due, today) {
  const days = daysUntil(due, today);
  if (days < 0) return { label: 'Overdue', level: 'red', days };
  if (days <= 7) return { label: 'Due soon', level: 'amber', days };
  if (days <= 30) return { label: 'Upcoming', level: 'gray', days };
  return { label: 'Scheduled', level: 'gray', days };
}

// ---------- Balances ----------
export function runningBalance(transactions, openingBalance) {
  let bal = openingBalance;
  for (const t of transactions) {
    if (t.type === 'income' || t.type === 'refund') bal += t.amount;
    else if (t.type === 'expense' || t.type === 'savings' || t.type === 'debt') bal -= t.amount;
  }
  return bal;
}
export function monthTotals(transactions, month) {
  let income = 0, expense = 0, savings = 0, debt = 0;
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') expense += t.amount;
    if (t.type === 'savings') savings += t.amount;
    if (t.type === 'debt') debt += t.amount;
  }
  return { income, expense, savings, debt };
}
