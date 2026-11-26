// Tombol B / I dan pemilih font per peran teks.
export function initFonts({ store }) {
  document.querySelectorAll('[data-font-row]').forEach((row) => {
    const select = row.querySelector('[data-font-family]');
    const toggles = [...row.querySelectorAll('[data-font-toggle]')];

    function render() {
      const script = store.get(select.dataset.bind) === 'script';
      for (const btn of toggles) {
        const on = Boolean(store.get(btn.dataset.path)) && !script;
        btn.disabled = script;
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('bg-[#8B7561]', on);
        btn.classList.toggle('border-[#8B7561]', on);
        btn.classList.toggle('text-white', on);
        btn.classList.toggle('bg-[#FFFFFF]', !on);
        btn.classList.toggle('text-[#493D35]', !on);
        btn.classList.toggle('opacity-40', script);
      }
    }

    select.addEventListener('change', () => {
      if (select.value === 'script') toggles.forEach((btn) => store.set(btn.dataset.path, false));
      render();
    });

    toggles.forEach((btn) =>
      btn.addEventListener('click', () => {
        store.set(btn.dataset.path, !store.get(btn.dataset.path));
        render();
      })
    );

    render();
  });
}