export function initNavigation({ onTabChange }) {
  document.querySelectorAll('nav button:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.style.display = 'block';
      onTabChange(btn.dataset.tab);
    });
  });

  document.getElementById('prevMonth').addEventListener('click', () => onTabChange('__prevMonth'));
  document.getElementById('nextMonth').addEventListener('click', () => onTabChange('__nextMonth'));
}
