import { fmt, allocationsForEvent, totalAllocated, unassignedMoney } from './calculations.js';

function uid() { return Math.random().toString(36).slice(2, 9); }

export function initPaychecksTab(ctx) {
  document.getElementById('addIncomeEvent').addEventListener('click', () => {
    const sourceId = document.getElementById('pe-source').value;
    const date = document.getElementById('pe-date').value;
    const expectedAmount = parseFloat(document.getElementById('pe-amount').value);
    if (!sourceId || !date || !expectedAmount) { alert('Pick a source, date, and expected amount.'); return; }
    ctx.state.incomeEvents.push({ id: uid(), sourceId, date, expectedAmount, actualAmount: null, status: 'planned' });
    ctx.save();
    document.getElementById('pe-amount').value = '';
    renderPaychecksTab(ctx);
  });
}

export function renderPaychecksTab(ctx) {
  const sourceSelect = document.getElementById('pe-source');
  const activeSources = ctx.state.incomeSources.filter(s => !s.archived);
  sourceSelect.innerHTML = activeSources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (!activeSources.length) {
    document.getElementById('paychecksList').innerHTML = '<div class="empty-state">Add an income source first (in Categories), then plan its paychecks here.</div>';
    return;
  }

  const events = [...ctx.state.incomeEvents].sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById('paychecksList').innerHTML = events.map(evt => {
    const source = ctx.state.incomeSources.find(s => s.id === evt.sourceId);
    const allocs = allocationsForEvent(ctx.state.paycheckPlans, evt.id);
    const allocated = totalAllocated(ctx.state.paycheckPlans, evt.id);
    const unassigned = unassignedMoney(evt, ctx.state.paycheckPlans);
    const base = evt.actualAmount != null ? evt.actualAmount : evt.expectedAmount;
    let statusClass = 'job-remaining', statusText = `${fmt(unassigned)} left to assign`;
    if (unassigned === 0) { statusClass = 'job-done'; statusText = 'Every dollar has a job.'; }
    else if (unassigned < 0) { statusClass = 'job-over'; statusText = `${fmt(Math.abs(unassigned))} over-planned for this paycheck`; }

    return `<div class="paycheck-card">
      <div class="paycheck-head">
        <span class="name">${source ? source.name : 'Income'} — ${evt.date}</span>
        <span class="amount">${evt.status === 'received' ? 'Received' : 'Planned'}: ${fmt(base)}</span>
      </div>
      <div class="paycheck-status ${statusClass}">${statusText}</div>
      <div>${allocs.map(a => `<div class="alloc-row"><span>${a.label}</span><span class="alloc-amt">${fmt(a.amount)}</span></div>`).join('') || '<div style="color:var(--muted);font-size:13px;">No allocations yet.</div>'}</div>
      <div class="alloc-add-row">
        <input type="text" placeholder="What's this for?" data-alloc-label="${evt.id}" style="flex:1;min-width:120px;">
        <input type="number" placeholder="Amount" data-alloc-amount="${evt.id}" style="width:100px;">
        <button class="btn btn-ghost" data-alloc-add="${evt.id}" style="padding:7px 12px;font-size:13px;">Add</button>
        ${evt.status !== 'received' ? `<button class="btn btn-ghost" data-mark-received="${evt.id}" style="padding:7px 12px;font-size:13px;">Mark received</button>` : ''}
      </div>
    </div>`;
  }).join('') || '<div class="empty-state">No paychecks planned yet. Add your next expected income above.</div>';

  document.querySelectorAll('[data-alloc-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const evtId = btn.dataset.allocAdd;
      const labelInput = document.querySelector(`[data-alloc-label="${evtId}"]`);
      const amountInput = document.querySelector(`[data-alloc-amount="${evtId}"]`);
      const label = labelInput.value.trim();
      const amount = parseFloat(amountInput.value);
      if (!label || !amount) return;
      ctx.state.paycheckPlans.push({ id: uid(), incomeEventId: evtId, label, amount });
      ctx.save(); renderPaychecksTab(ctx);
    });
  });

  document.querySelectorAll('[data-mark-received]').forEach(btn => {
    btn.addEventListener('click', () => {
      const evt = ctx.state.incomeEvents.find(e => e.id === btn.dataset.markReceived);
      const amountStr = prompt('Actual amount received?', evt.expectedAmount);
      if (amountStr === null) return;
      const amount = parseFloat(amountStr);
      if (!amount) return;
      evt.actualAmount = amount;
      evt.status = 'received';
      // Offer to create a linked income transaction so it flows into the dashboard totals.
      const alreadyLinked = ctx.state.transactions.some(t => t.linkedIncomeEventId === evt.id);
      if (!alreadyLinked) {
        ctx.state.transactions.push({
          id: uid(), date: evt.date, description: 'Paycheck received', type: 'income',
          category: null, source: evt.sourceId, goalsBufferId: null, amount, linkedIncomeEventId: evt.id,
        });
      }
      ctx.save(); ctx.renderAll();
    });
  });
}
