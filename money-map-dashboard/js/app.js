import { loadState, saveState } from './store.js';
import { todayStr, fmt } from './calculations.js';
import { initNavigation } from './navigation.js';
import { renderDashboard } from './dashboard.js';
import { initTransactions, renderLedger } from './transactions.js';
import { initCategories, renderCategoriesTab } from './categories.js';
import { initSavingsTab, renderSavingsTab, purposeTypeOptions } from './savings.js';
import { initPaychecksTab, renderPaychecksTab } from './paychecks.js';
import { initBillsTab, renderBillsTab } from './bills.js';

let state = loadState();
let currentMonth = todayStr().slice(0, 7);

function save() { saveState(state); }

const ctx = {
  get state() { return state; },
  get currentMonth() { return currentMonth; },
  save,
  renderAll,
};

function renderAll() {
  renderDashboard(ctx);
  const ledgerVisible = document.getElementById('tab-transactions').style.display !== 'none';
  if (ledgerVisible) renderLedger(ctx);
}

function shiftMonth(delta) {
  const [y, m] = currentMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  currentMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  renderAll();
}

initNavigation({
  onTabChange: (tab) => {
    if (tab === '__prevMonth') return shiftMonth(-1);
    if (tab === '__nextMonth') return shiftMonth(1);
    // Dashboard must always recompute on entry — it's the one screen every other
    // tab's edits (bills, categories, goals, sources) need to stay in sync with,
    // and none of those tabs call renderAll() on every edit.
    if (tab === 'dashboard') renderDashboard(ctx);
    if (tab === 'transactions') renderLedger(ctx);
    if (tab === 'categories') renderCategoriesTab(ctx);
    if (tab === 'savings') renderSavingsTab(ctx);
    if (tab === 'paychecks') renderPaychecksTab(ctx);
    if (tab === 'bills') renderBillsTab(ctx);
    if (tab === 'settings') renderSettings();
  },
});
initTransactions(ctx);
initCategories(ctx);
initSavingsTab(ctx);
initPaychecksTab(ctx);
initBillsTab(ctx);
document.getElementById('newGoalPurpose').innerHTML = purposeTypeOptions();

// ---------- Settings ----------
function renderSettings() {
  document.getElementById('settingsOpening').value = state.openingBalance;
}
document.getElementById('settingsOpening').addEventListener('change', (e) => {
  state.openingBalance = parseFloat(e.target.value) || 0; save();
});
document.getElementById('exportCsv').addEventListener('click', () => {
  let csv = 'Date,Description,Type,Category,Amount\n';
  state.transactions.forEach(t => {
    const cat = state.categories.find(c => c.id === t.category);
    const goal = state.goalsBuffers.find(g => g.id === t.goalsBufferId);
    const src = state.incomeSources.find(s => s.id === t.source);
    let label = '';
    if (t.type === 'income') label = src ? src.name : '';
    else if (t.type === 'savings') label = goal ? goal.name : '';
    else if (cat) label = cat.name;
    csv += `${t.date},"${t.description}",${t.type},"${label}",${t.amount}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'budget-ledger-export.csv';
  a.click();
});
document.getElementById('resetAll').addEventListener('click', () => {
  if (confirm('This will permanently delete everything in this browser. Continue?')) {
    if (confirm('Are you absolutely sure? This cannot be undone.')) {
      localStorage.clear();
      location.reload();
    }
  }
});

// ---------- Onboarding ----------
function renderOnboardIncomeSources() {
  const el = document.getElementById('ob-income-sources');
  if (!state.incomeSources.length) state.incomeSources.push({ id: 'primary', name: 'Primary Income', planned: 0, archived: false });
  el.innerHTML = state.incomeSources.map(s => `
    <div class="cat-list-item"><span>${s.name}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="number" style="width:90px;padding:6px;border:1px solid var(--line);border-radius:6px;" data-ob-source="${s.id}" value="${s.planned || ''}" placeholder="0">
        <span class="remove-link" data-ob-source-remove="${s.id}">Remove</span>
      </div></div>`).join('');
  el.querySelectorAll('[data-ob-source]').forEach(inp => {
    inp.addEventListener('input', () => { state.incomeSources.find(s => s.id === inp.dataset.obSource).planned = parseFloat(inp.value) || 0; });
  });
  el.querySelectorAll('[data-ob-source-remove]').forEach(link => {
    link.addEventListener('click', () => { state.incomeSources = state.incomeSources.filter(s => s.id !== link.dataset.obSourceRemove); renderOnboardIncomeSources(); });
  });
}
document.getElementById('ob-add-source').addEventListener('click', () => {
  const name = document.getElementById('ob-new-source-name').value.trim();
  if (!name) return;
  state.incomeSources.push({ id: Math.random().toString(36).slice(2, 9), name, planned: parseFloat(document.getElementById('ob-new-source-amount').value) || 0, archived: false });
  document.getElementById('ob-new-source-name').value = ''; document.getElementById('ob-new-source-amount').value = '';
  renderOnboardIncomeSources();
});

function renderOnboardCategories() {
  document.getElementById('ob-categories').innerHTML = state.categories.map(c => `
    <div class="cat-list-item"><span>${c.name}</span>
      <input type="number" style="width:90px;padding:6px;border:1px solid var(--line);border-radius:6px;" data-ob-budget="${c.id}" value="${c.budget || ''}" placeholder="0"></div>`).join('');
  document.querySelectorAll('[data-ob-budget]').forEach(inp => {
    inp.addEventListener('input', () => { state.categories.find(c => c.id === inp.dataset.obBudget).budget = parseFloat(inp.value) || 0; });
  });
}

document.getElementById('ob-finish').addEventListener('click', () => {
  state.openingBalance = parseFloat(document.getElementById('ob-balance').value) || 0;
  state.onboarded = true;
  save();
  showApp();
});

function showApp() {
  document.getElementById('view-onboard').classList.remove('active');
  document.getElementById('view-main').classList.add('active');
  renderAll();
}

if (state.onboarded) {
  showApp();
} else {
  renderOnboardIncomeSources();
  renderOnboardCategories();
  document.getElementById('view-onboard').classList.add('active');
}
