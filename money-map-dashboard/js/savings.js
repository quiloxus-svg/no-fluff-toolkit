import { fmt, goalsBufferCurrentAmount, goalsBufferStatus, suggestedMonthlyContribution } from './calculations.js';

const PURPOSE_TYPES = ['Future Expense', 'Safety Buffer', 'Personal Goal', 'Planned Contribution'];
function uid() { return Math.random().toString(36).slice(2, 9); }

export function initSavingsTab(ctx) {
  document.getElementById('addGoalBuffer').addEventListener('click', () => {
    const name = document.getElementById('newGoalName').value.trim();
    const purposeType = document.getElementById('newGoalPurpose').value;
    const targetAmount = parseFloat(document.getElementById('newGoalTarget').value) || 0;
    const targetDate = document.getElementById('newGoalDate').value || null;
    if (!name) return;
    ctx.state.goalsBuffers.push({
      id: uid(), name, purposeType, targetAmount, startingAmount: 0, targetDate,
      contributionFrequency: null, contributionAmount: null, priority: 'normal', notes: '', archived: false,
    });
    ctx.save();
    document.getElementById('newGoalName').value = ''; document.getElementById('newGoalTarget').value = ''; document.getElementById('newGoalDate').value = '';
    renderSavingsTab(ctx);
  });
}

export function renderSavingsTab(ctx) {
  const el = document.getElementById('goalsBuffersList');
  const active = ctx.state.goalsBuffers.filter(g => !g.archived);
  el.innerHTML = active.map(g => {
    const current = goalsBufferCurrentAmount(ctx.state.transactions, g);
    const status = goalsBufferStatus(current, g.targetAmount);
    const suggestion = suggestedMonthlyContribution(current, g.targetAmount, g.targetDate);
    const pct = status.pct == null ? 0 : Math.min(status.pct, 100);
    return `<div class="cat-card">
      <div class="cat-top">
        <div><div class="cat-name">${g.name}</div><div class="cat-sub">${g.purposeType}${g.targetDate ? ' · target ' + g.targetDate : ''}</div></div>
        <div class="cat-amounts">${fmt(current)} of ${g.targetAmount ? fmt(g.targetAmount) : '—'}</div>
      </div>
      <div class="cat-bar-track"><div class="cat-bar-fill ${status.level}" style="width:${pct}%"></div></div>
      <div class="cat-status ${status.level}">${status.label}${status.pct != null ? ' · ' + Math.round(status.pct) + '%' : ''}</div>
      ${suggestion != null ? `<div style="font-size:12.5px;color:var(--muted);margin-top:6px;">Suggested: ${fmt(suggestion)}/month to hit target date</div>` : ''}
      <span class="remove-link" data-goal-archive="${g.id}" style="display:inline-block;margin-top:8px;">Archive</span>
    </div>`;
  }).join('') || '<div class="empty-state">No goals or buffers yet. Add one above.</div>';

  document.querySelectorAll('[data-goal-archive]').forEach(link => {
    link.addEventListener('click', () => {
      ctx.state.goalsBuffers.find(g => g.id === link.dataset.goalArchive).archived = true;
      ctx.save(); renderSavingsTab(ctx);
    });
  });
}

export function purposeTypeOptions() {
  return PURPOSE_TYPES.map(p => `<option value="${p}">${p}</option>`).join('');
}
