import { fmt, monthLabel, monthTotals, runningBalance, categorySpending, categoryStatus,
         goalsBufferCurrentAmount, goalsBufferStatus, incomeReceivedFromSource } from './calculations.js';
import { renderTxTable } from './transactions.js';

function activeCategories(state) { return state.categories.filter(c => !c.archived); }
function activeGoalsBuffers(state) { return state.goalsBuffers.filter(g => !g.archived); }
function activeSources(state) { return state.incomeSources.filter(s => !s.archived); }
function totalPlannedIncome(state) { return activeSources(state).reduce((s, x) => s + (x.planned || 0), 0); }

export function renderDashboard(ctx) {
  const { state, currentMonth } = ctx;
  document.getElementById('monthLabel').textContent = monthLabel(currentMonth);
  const totals = monthTotals(state.transactions, currentMonth);
  const bal = runningBalance(state.transactions, state.openingBalance);
  const plannedIncome = totalPlannedIncome(state);
  const remaining = plannedIncome - totals.expense - totals.savings - totals.debt;

  document.getElementById('snapshotGrid').innerHTML = `
    <div class="snap-card"><div class="label">Planned Income</div><div class="value">${fmt(plannedIncome)}</div></div>
    <div class="snap-card"><div class="label">Income Received</div><div class="value">${fmt(totals.income)}</div></div>
    <div class="snap-card"><div class="label">Total Expenses</div><div class="value">${fmt(totals.expense)}</div></div>
    <div class="snap-card"><div class="label">Savings + Debt</div><div class="value">${fmt(totals.savings + totals.debt)}</div></div>
    <div class="snap-card"><div class="label">Remaining Planned</div><div class="value ${remaining < 0 ? 'neg' : ''}">${fmt(remaining)}</div></div>
    <div class="snap-card"><div class="label">Running Balance</div><div class="value ${bal < 0 ? 'neg' : ''}">${fmt(bal)}</div></div>
  `;

  const sources = activeSources(state);
  document.getElementById('incomeSourcesGrid').innerHTML = sources.length ? sources.map(s => {
    const received = incomeReceivedFromSource(state.transactions, currentMonth, s.id);
    return `<div class="income-row"><span class="name">${s.name}</span><span class="figures">${fmt(s.planned)} planned / <strong>${fmt(received)}</strong> received</span></div>`;
  }).join('') : '<div class="empty-state">No income sources yet. Add one in Categories.</div>';

  const cats = activeCategories(state);
  const catData = cats.map(c => {
    const spending = categorySpending(state.transactions, currentMonth, c.id);
    return { ...c, spending, status: categoryStatus(spending, c.budget) };
  });
  document.getElementById('catGrid').innerHTML = catData.map(c => {
    const pct = c.status.pct == null ? (c.spending > 0 ? 100 : 0) : Math.min(c.status.pct, 100);
    return `<div class="cat-card">
      <div class="cat-top"><div class="cat-name">${c.name}</div><div class="cat-amounts">${fmt(c.spending)} of ${c.budget ? fmt(c.budget) : '—'}</div></div>
      <div class="cat-bar-track"><div class="cat-bar-fill ${c.status.level}" style="width:${pct}%"></div></div>
      <div class="cat-status ${c.status.level}">${c.status.label}${c.status.pct != null ? ' · ' + Math.round(c.status.pct) + '%' : ''}</div>
    </div>`;
  }).join('') || '<div class="empty-state">No expense categories yet.</div>';

  const goals = activeGoalsBuffers(state);
  const goalData = goals.map(g => {
    const current = goalsBufferCurrentAmount(state.transactions, g);
    return { ...g, current, status: goalsBufferStatus(current, g.targetAmount) };
  });
  document.getElementById('savingsGrid').innerHTML = goalData.map(g => {
    const pct = g.status.pct == null ? 0 : Math.min(g.status.pct, 100);
    return `<div class="cat-card">
      <div class="cat-top"><div><div class="cat-name">${g.name}</div><div class="cat-sub">${g.purposeType}</div></div><div class="cat-amounts">${fmt(g.current)} of ${g.targetAmount ? fmt(g.targetAmount) : '—'}</div></div>
      <div class="cat-bar-track"><div class="cat-bar-fill ${g.status.level}" style="width:${pct}%"></div></div>
      <div class="cat-status ${g.status.level}">${g.status.label}${g.status.pct != null ? ' · ' + Math.round(g.status.pct) + '%' : ''}</div>
    </div>`;
  }).join('') || '<div class="empty-state">No goals or buffers yet.</div>';

  const watchList = catData.filter(c => ['Watch', 'Needs attention', 'Over plan', 'Unplanned spending'].includes(c.status.label));
  const attnSection = document.getElementById('attentionSection');
  if (watchList.length) {
    attnSection.style.display = 'block';
    document.getElementById('attentionList').innerHTML = watchList.map(c =>
      `<div class="attn-item ${c.status.level === 'amber' ? 'amber' : ''}">${c.name}: ${c.status.label}${c.status.pct != null ? ' — ' + Math.round(c.status.pct) + '% used' : ''}</div>`
    ).join('');
  } else { attnSection.style.display = 'none'; }

  const overPlan = catData.filter(c => c.status.label === 'Over plan').sort((a, b) => b.spending - a.spending)[0];
  const needsAttn = catData.filter(c => c.status.label === 'Needs attention')[0];
  const monthTx = state.transactions.filter(t => t.date.slice(0, 7) === currentMonth);
  let action;
  if (overPlan) action = `${overPlan.name} is over plan by ${fmt(overPlan.spending - overPlan.budget)}.`;
  else if (needsAttn) action = `${needsAttn.name} needs attention — ${fmt(needsAttn.budget - needsAttn.spending)} remaining this month.`;
  else if (monthTx.length === 0) action = `No transactions logged yet for ${monthLabel(currentMonth)}. Add your first one to see this month's picture.`;
  else action = `Spending is within plan for ${monthLabel(currentMonth)}. Review your progress before the month ends.`;
  document.getElementById('nextAction').innerHTML = `<div class="tag">Top Next Action</div><div class="msg">${action}</div>`;

  const recent = state.transactions.filter(t => t.date.slice(0, 7) === currentMonth).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  document.getElementById('recentActivity').innerHTML = recent.length ? renderTxTable(state, recent) : '<div class="empty-state">No transactions yet this month.</div>';
}
