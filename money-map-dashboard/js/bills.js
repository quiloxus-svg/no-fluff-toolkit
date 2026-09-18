import { fmt, todayStr, nextDueDate, billStatus } from './calculations.js';

function uid() { return Math.random().toString(36).slice(2, 9); }

export function initBillsTab(ctx) {
  document.getElementById('addBill').addEventListener('click', () => {
    const name = document.getElementById('bill-name').value.trim();
    const categoryId = document.getElementById('bill-category').value || null;
    const typicalAmount = parseFloat(document.getElementById('bill-amount').value);
    const frequency = document.getElementById('bill-frequency').value;
    const anchorDate = document.getElementById('bill-date').value;
    const autopay = document.getElementById('bill-autopay').checked;
    if (!name || !typicalAmount || !anchorDate) { alert('Please enter a name, amount, and due date.'); return; }
    ctx.state.bills.push({ id: uid(), name, category: categoryId, typicalAmount, frequency, anchorDate, autopay, lastPaidDate: null, notes: '', archived: false });
    ctx.save();
    document.getElementById('bill-name').value = ''; document.getElementById('bill-amount').value = '';
    renderBillsTab(ctx);
  });
}

export function renderBillsTab(ctx) {
  const catSelect = document.getElementById('bill-category');
  const activeCats = ctx.state.categories.filter(c => !c.archived);
  catSelect.innerHTML = '<option value="">No category</option>' + activeCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const today = todayStr();
  const active = ctx.state.bills.filter(b => !b.archived);
  const billData = active.map(b => {
    const due = nextDueDate(b);
    return { ...b, due, status: billStatus(due, today) };
  }).sort((a, b) => a.due.localeCompare(b.due));

  document.getElementById('billsList').innerHTML = billData.map(b => {
    const cat = ctx.state.categories.find(c => c.id === b.category);
    return `<div class="paycheck-card">
      <div class="paycheck-head">
        <span class="name">${b.name}${cat ? ' · ' + cat.name : ''}</span>
        <span class="amount">${fmt(b.typicalAmount)}${b.autopay ? ' · Autopay' : ''}</span>
      </div>
      <div class="paycheck-status ${b.status.level === 'red' ? 'job-over' : b.status.level === 'amber' ? 'job-remaining' : 'job-done'}">
        ${b.status.label} — ${b.due}${b.status.days >= 0 ? ` (${b.status.days} day${b.status.days === 1 ? '' : 's'})` : ` (${Math.abs(b.status.days)} day${Math.abs(b.status.days) === 1 ? '' : 's'} overdue)`}
      </div>
      <div class="alloc-add-row">
        <button class="btn btn-ghost" data-mark-paid="${b.id}" style="padding:7px 12px;font-size:13px;">Mark paid</button>
        <span class="remove-link" data-bill-archive="${b.id}" style="align-self:center;">Archive</span>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state">No bills added yet. Add your first recurring bill to make upcoming costs visible.</div>';

  document.querySelectorAll('[data-mark-paid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bill = ctx.state.bills.find(b => b.id === btn.dataset.markPaid);
      const due = nextDueDate(bill);
      bill.lastPaidDate = due;
      // Duplicate-prevention: only create a linked expense transaction if one doesn't already exist for this due date.
      const alreadyLinked = ctx.state.transactions.some(t => t.linkedBillId === bill.id && t.linkedBillDueDate === due);
      if (!alreadyLinked) {
        ctx.state.transactions.push({
          id: uid(), date: due, description: bill.name + ' (bill)', type: 'expense',
          category: bill.category, source: null, goalsBufferId: null, amount: bill.typicalAmount,
          linkedBillId: bill.id, linkedBillDueDate: due,
        });
      }
      ctx.save(); ctx.renderAll(); renderBillsTab(ctx);
    });
  });
  document.querySelectorAll('[data-bill-archive]').forEach(el => {
    el.addEventListener('click', () => {
      ctx.state.bills.find(b => b.id === el.dataset.billArchive).archived = true;
      ctx.save(); renderBillsTab(ctx);
    });
  });
}

// Used by the dashboard for the "Upcoming Bills" card and Top Next Action.
export function upcomingBills(state, withinDays = 14) {
  const today = todayStr();
  return state.bills.filter(b => !b.archived).map(b => {
    const due = nextDueDate(b);
    return { ...b, due, status: billStatus(due, today) };
  }).filter(b => b.status.days <= withinDays).sort((a, b) => a.due.localeCompare(b.due));
}
