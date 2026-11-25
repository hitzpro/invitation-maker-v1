// Pemilih pola latar + mengatur kontrol mana yang aktif sesuai pengaturan tema.
export function initTheme({ store }) {
  const picks = [...document.querySelectorAll('[data-pattern-pick]')];

  function renderPicks() {
    const kind = store.get('theme.pattern.kind');
    for (const btn of picks) {
      const on = btn.dataset.patternPick === kind;
      btn.classList.toggle('border-black', on);
      btn.classList.toggle('ring-2', on);
      btn.classList.toggle('ring-black', on);
      btn.setAttribute('aria-pressed', String(on));
    }
  }

  // Kontrol per section hanya berguna bila fitur menyala dan tidak berlaku "semua section"
  function refreshFlags() {
    const patternOff = store.get('theme.pattern.kind') === 'none';
    const patternAll = store.get('theme.pattern.all');
    const animationOff = !store.get('theme.animation.enabled');
    const animationAll = store.get('theme.animation.all');

    document.querySelector('[data-bind="theme.pattern.opacity"]').disabled = patternOff;
    document.querySelector('[data-bind="theme.pattern.all"]').disabled = patternOff;
    document.querySelector('[data-bind="theme.animation.all"]').disabled = animationOff;

    document.querySelectorAll('[data-style-flag="pattern"]').forEach((el) => {
      el.disabled = patternOff || patternAll;
    });
    document.querySelectorAll('[data-style-flag="animate"]').forEach((el) => {
      el.disabled = animationOff || animationAll;
    });
  }

  picks.forEach((btn) => {
    btn.addEventListener('click', () => {
      store.set('theme.pattern.kind', btn.dataset.patternPick);
      renderPicks();
      refreshFlags();
    });
  });

  document.querySelectorAll('[data-bind^="theme."]').forEach((el) => {
    el.addEventListener('change', refreshFlags);
  });

  renderPicks();
  refreshFlags();

    // Kontrol foto latar hanya tampil saat Latar = Foto
  document.querySelectorAll('[data-style-block]').forEach((block) => {
    const select = block.querySelector('[data-surface-select]');
    const box = block.querySelector('[data-bg-controls]');
    const sync = () => box.classList.toggle('hidden', select.value !== 'image');
    select.addEventListener('change', sync);
    sync();
  });
}