function uid() { return Math.random().toString(36).slice(2, 9); }

export function initCategories(ctx) {
  document.getElementById('addSource').addEventListener('click', () => {
    const name = document.getElementById('newSourceName').value.trim();
    const planned = parseFloat(document.getElementById('newSourceAmount').value) || 0;
    if (!name) return;
    ctx.state.incomeSources.push({ id: uid(), name, planned, payDate: null, frequency: null, archived: false });
    ctx.save();
    document.getElementById('newSourceName').value = ''; document.getElementById('newSourceAmount').value = '';
    renderSourceList(ctx);
  });

  document.getElementById('addCategory').addEventListener('click', () => {
    const name = document.getElementById('newCatName').value.trim();
    const budget = parseFloat(document.getElementById('newCatBudget').value) || 0;
    if (!name) return;
    ctx.state.categories.push({ id: uid(), name, budget, archived: false, kind: 'expense' });
    ctx.save();
    document.getElementById('newCatName').value = ''; document.getElementById('newCatBudget').value = '';
    renderCategoryList(ctx);
  });
}

export function renderCategoriesTab(ctx) {
  renderSourceList(ctx);
  renderCategoryList(ctx);
}

function renderSourceList(ctx) {
  const active = ctx.state.incomeSources.filter(s => !s.archived);
  document.getElementById('sourceList').innerHTML = active.map(s => `
    <div class="cat-list-item">
      <span>${s.name}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="number" style="width:90px;padding:6px;border:1px solid var(--line);border-radius:6px;" data-source-planned="${s.id}" value="${s.planned || ''}" placeholder="0">
        <span class="remove-link" data-source-archive="${s.id}">Archive</span>
      </div>
    </div>`).join('') || '<div class="empty-state">No income sources yet.</div>';
  document.querySelectorAll('[data-source-planned]').forEach(inp => {
    inp.addEventListener('input', () => {
      ctx.state.incomeSources.find(s => s.id === inp.dataset.sourcePlanned).planned = parseFloat(inp.value) || 0;
      ctx.save();
    });
  });
  document.querySelectorAll('[data-source-archive]').forEach(el => {
    el.addEventListener('click', () => {
      ctx.state.incomeSources.find(s => s.id === el.dataset.sourceArchive).archived = true;
      ctx.save(); renderSourceList(ctx);
    });
  });
}

function renderCategoryList(ctx) {
  const active = ctx.state.categories.filter(c => !c.archived);
  document.getElementById('categoryList').innerHTML = active.map(c => `
    <div class="cat-list-item">
      <span>${c.name}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <input type="number" style="width:90px;padding:6px;border:1px solid var(--line);border-radius:6px;" data-cat-budget="${c.id}" value="${c.budget || ''}" placeholder="0">
        <span class="remove-link" data-cat-archive="${c.id}">Archive</span>
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-cat-budget]').forEach(inp => {
    inp.addEventListener('input', () => {
      ctx.state.categories.find(c => c.id === inp.dataset.catBudget).budget = parseFloat(inp.value) || 0;
      ctx.save();
    });
  });
  document.querySelectorAll('[data-cat-archive]').forEach(el => {
    el.addEventListener('click', () => {
      ctx.state.categories.find(c => c.id === el.dataset.catArchive).archived = true;
      ctx.save(); renderCategoryList(ctx);
    });
  });
}
