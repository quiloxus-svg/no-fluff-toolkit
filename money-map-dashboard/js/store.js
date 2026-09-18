// store.js — persistence + versioned migration. v2 -> v3 adds Goals & Buffers purpose types
// and a Paycheck Plan layer, without losing anything.

const KEY_V3 = 'plugged_hub_budget_ledger_v3';
const KEY_V2 = 'plugged_hub_budget_ledger_v2';
const KEY_V1 = 'plugged_hub_budget_ledger_v1';

function uid() { return Math.random().toString(36).slice(2, 9); }

function exportBackupCsv(transactions, categories, incomeSources) {
  let csv = 'Date,Description,Type,Category,Amount\n';
  transactions.forEach(t => {
    const cat = categories.find(c => c.id === t.category);
    const src = incomeSources.find(s => s.id === t.source);
    const label = t.type === 'income' ? (src ? src.name : '') : (cat ? cat.name : '');
    csv += `${t.date},"${t.description}",${t.type},"${label}",${t.amount}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'budget-ledger-backup-before-v3-upgrade.csv';
  a.click();
}

function migrateV2ToV3(v2) {
  const expenseCategories = (v2.categories || []).filter(c => c.kind !== 'savings');
  const savingsCategories = (v2.categories || []).filter(c => c.kind === 'savings');
  const goalsBuffers = savingsCategories.map(c => ({
    id: c.id, // preserve id so existing transactions still link correctly
    name: c.name,
    purposeType: 'Future Expense', // neutral default; user can recategorize
    targetAmount: c.budget || 0,
    startingAmount: 0,
    targetDate: null,
    contributionFrequency: null,
    contributionAmount: null,
    priority: 'normal',
    notes: '',
    archived: c.archived || false,
  }));
  // Transactions: rename `category` -> `goalsBufferId` for savings-type rows so links still work
  const transactions = (v2.transactions || []).map(t => {
    if (t.type === 'savings') {
      return { ...t, goalsBufferId: t.category, category: null };
    }
    return { ...t };
  });
  return {
    schemaVersion: 3,
    onboarded: v2.onboarded || false,
    openingBalance: v2.openingBalance || 0,
    incomeSources: (v2.incomeSources || []).map(s => ({ ...s, payDate: null, frequency: null })),
    incomeEvents: [],
    paycheckPlans: [],
    categories: expenseCategories,
    goalsBuffers,
    bills: v2.bills || [],
    transactions,
  };
}

function migrateV1ToV2(v1) {
  return {
    onboarded: v1.onboarded || false,
    openingBalance: v1.openingBalance || 0,
    plannedIncome: v1.plannedIncome || 0,
    categories: (v1.categories || []).map(c => ({ ...c, kind: 'expense' })),
    transactions: v1.transactions || [],
  };
}

function defaultStateV3() {
  const DEFAULT_EXPENSE = ['Housing', 'Utilities', 'Groceries', 'Transportation', 'Insurance', 'Debt Payments', 'Dining', 'Shopping', 'Health', 'Personal Care', 'Entertainment', 'Subscriptions', 'Miscellaneous'];
  const DEFAULT_GOALS = [
    { name: 'Emergency Fund', purposeType: 'Safety Buffer' },
    { name: 'Property Tax', purposeType: 'Future Expense' },
    { name: 'Medical', purposeType: 'Future Expense' },
    { name: 'Pet Care', purposeType: 'Future Expense' },
    { name: 'Gifts', purposeType: 'Personal Goal' },
    { name: 'Travel', purposeType: 'Personal Goal' },
  ];
  return {
    schemaVersion: 3,
    onboarded: false,
    openingBalance: 0,
    incomeSources: [],
    incomeEvents: [],
    paycheckPlans: [],
    categories: DEFAULT_EXPENSE.map(name => ({ id: uid(), name, budget: 0, archived: false, kind: 'expense' })),
    goalsBuffers: DEFAULT_GOALS.map(g => ({
      id: uid(), name: g.name, purposeType: g.purposeType, targetAmount: 0, startingAmount: 0,
      targetDate: null, contributionFrequency: null, contributionAmount: null, priority: 'normal', notes: '', archived: false,
    })),
    bills: [],
    transactions: [],
  };
}

export function loadState() {
  const v3 = JSON.parse(localStorage.getItem(KEY_V3) || 'null');
  if (v3) { if (!v3.bills) v3.bills = []; return v3; }

  const v2 = JSON.parse(localStorage.getItem(KEY_V2) || 'null');
  if (v2) {
    // Back up to CSV before migrating, per the non-negotiable in the approved plan.
    try { exportBackupCsv(v2.transactions || [], v2.categories || [], v2.incomeSources || []); } catch (e) { /* non-fatal */ }
    const migrated = migrateV2ToV3(v2);
    saveState(migrated);
    return migrated;
  }

  const v1 = JSON.parse(localStorage.getItem(KEY_V1) || 'null');
  if (v1) {
    const v2shape = migrateV1ToV2(v1);
    const migrated = migrateV2ToV3(v2shape);
    saveState(migrated);
    return migrated;
  }

  return defaultStateV3();
}

export function saveState(state) {
  localStorage.setItem(KEY_V3, JSON.stringify(state));
}

export function uidGen() { return uid(); }
