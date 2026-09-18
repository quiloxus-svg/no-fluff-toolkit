import { fmt, todayStr } from './calculations.js';

export function renderTxTable(state, txs) {
  return `<table class="tx-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th style="text-align:right;">Amount</th><th></th></tr></thead><tbody>
    ${txs.map(t => {
      const cat = state.categories.find(c => c.id === t.category);
      const goal = state.goalsBuffers.find(g => g.id === t.goalsBufferId);
      const src = state.incomeSources.find(s => s.id === t.source);
      let label = '—';
      if (t.type === 'income') label = src ? src.name : '—';
      else if (t.type === 'savings') label = goal ? goal.name : '—';
      else if (cat) label = cat.name;
      const sign = (t.type === 'income' || t.type === 'refund') ? '+' : (t.type === 'transfer' ? '' : '-');
      return `<tr>
        <td>${t.date}</td><td>${t.description}</td>
        <td><span class="type-pill ${t.type}">${t.type}</span></td>
        <td>${label}</td>
        <td class="tx-amount ${t.type === 'income' ? 'income' : 'expense'}">${sign}${fmt(t.amount)}</td>
        <td class="tx-actions"><span data-del="${t.id}">Delete</span></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

export function initTransactions(ctx) {
  document.getElementById('tx-type').addEventListener('change', () => updateTxFieldVisibility());
  document.getElementById('addTx').addEventListener('click', () => addTransaction(ctx));
  ['filterSearch', 'filterCategory', 'filterType'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => applyLedgerFilters(ctx));
  });
}

function updateTxFieldVisibility() {
  const type = document.getElementById('tx-type').value;
  document.getElementById('tx-cat-field').style.display = (type === 'expense' || type === 'refund') ? 'flex' : 'none';
  document.getElementById('tx-savings-field').style.display = (type === 'savings') ? 'flex' : 'none';
  document.getElementById('tx-source-field').style.display = (type === 'income') ? 'flex' : 'none';
}

function populateCategorySelects(state) {
  const activeCats = state.categories.filter(c => !c.archived);
  const activeGoals = state.goalsBuffers.filter(g => !g.archived);
  const activeSrc = state.incomeSources.filter(s => !s.archived);
  document.getElementById('tx-category').innerHTML = activeCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('tx-savings-category').innerHTML = activeGoals.map(g => `<option value="${g.id}">${g.name} (${g.purposeType})</option>`).join('');
  document.getElementById('tx-source').innerHTML = activeSrc.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('filterCategory').innerHTML = '<option value="">All categories</option>' +
    activeCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('') +
    activeGoals.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

export function renderLedger(ctx) {
  populateCategorySelects(ctx.state);
  updateTxFieldVisibility();
  if (!document.getElementById('tx-date').value) document.getElementById('tx-date').value = todayStr();
  applyLedgerFilters(ctx);
}

function applyLedgerFilters(ctx) {
  const { state, currentMonth } = ctx;
  const search = document.getElementById('filterSearch').value.toLowerCase();
  const catFilter = document.getElementById('filterCategory').value;
  const typeFilter = document.getElementById('filterType').value;
  let txs = state.transactions.filter(t => t.date.slice(0, 7) === currentMonth);
  if (search) txs = txs.filter(t => t.description.toLowerCase().includes(search));
  if (catFilter) txs = txs.filter(t => t.category === catFilter || t.goalsBufferId === catFilter);
  if (typeFilter) txs = txs.filter(t => t.type === typeFilter);
  txs.sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('ledgerTableWrap').innerHTML = txs.length ? renderTxTable(state, txs) : '<div class="empty-state">No transactions match.</div>';
  document.querySelectorAll('#ledgerTableWrap [data-del]').forEach(el => {
    el.addEventListener('click', () => {
      state.transactions = state.transactions.filter(t => t.id !== el.dataset.del);
      ctx.save(); ctx.renderAll();
    });
  });
}

function addTransaction(ctx) {
  const { state } = ctx;
  const date = document.getElementById('tx-date').value || todayStr();
  const desc = document.getElementById('tx-desc').value.trim();
  const type = document.getElementById('tx-type').value;
  let category = null, source = null, goalsBufferId = null;
  if (type === 'expense' || type === 'refund') category = document.getElementById('tx-category').value || null;
  if (type === 'savings') goalsBufferId = document.getElementById('tx-savings-category').value || null;
  if (type === 'income') source = document.getElementById('tx-source').value || null;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  if (!desc || !amount || amount <= 0) { alert('Please enter a description and a positive amount.'); return; }
  state.transactions.push({ id: Math.random().toString(36).slice(2, 9), date, description: desc, type, category, source, goalsBufferId, amount });
  ctx.save();
  document.getElementById('tx-desc').value = ''; document.getElementById('tx-amount').value = '';
  ctx.renderAll();
}
