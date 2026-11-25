// Buka/tutup kartu, aktif/nonaktif, dan pengurutan section.
export function initSections({ store, onFocusSection }) {
  const container = document.getElementById('sections');
  const defaultOrder = JSON.parse(container.dataset.defaultOrder);
  const cardOf = (key) => container.querySelector(`:scope > [data-section="${key}"]`);

  // Tampilan kartu mengikuti status enabled
  function refreshCard(card) {
    const enabled = store.get(`sections.${card.dataset.section}.enabled`);
    card.classList.toggle('bg-gray-50', !enabled);
    card.querySelector('[data-card-title]').classList.toggle('text-gray-400', !enabled);
    card.querySelector('[data-badge-off]').classList.toggle('hidden', enabled);
  }

  // Menyelaraskan urutan kartu di layar dengan sectionOrder di state
  function syncOrder() {
    const order = store.get('sectionOrder');
    order.forEach((key) => container.append(cardOf(key)));

    order.forEach((key, i) => {
      const card = cardOf(key);
      const up = card.querySelector('[data-move-up]');
      const down = card.querySelector('[data-move-down]');
      if (up) up.disabled = i <= 1; // posisi 0 dikunci untuk cover
      if (down) down.disabled = i === order.length - 1;
    });
  }

  function move(key, delta) {
    const order = store.get('sectionOrder');
    const from = order.indexOf(key);
    const to = from + delta;
    if (from < 1 || to < 1 || to >= order.length) return;

    store.move('sectionOrder', from, to);
    syncOrder();
    cardOf(key).scrollIntoView({ block: 'nearest' });
  }

  container.querySelectorAll(':scope > [data-section]').forEach((card) => {
    const key = card.dataset.section;
    const body = card.querySelector('[data-card-body]');
    const toggle = card.querySelector('[data-card-toggle]');
    const up = card.querySelector('[data-move-up]');
    const down = card.querySelector('[data-move-down]');

    toggle.addEventListener('click', () => {
      const isOpen = body.classList.toggle('hidden') === false;
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) onFocusSection?.(key);
    });

    body.addEventListener('focusin', () => onFocusSection?.(key));

    up?.addEventListener('click', () => {
      move(key, -1);
      up.focus();
    });
    down?.addEventListener('click', () => {
      move(key, 1);
      down.focus();
    });

    // Nilai checkbox sudah disimpan ke store oleh pengikat data-bind (event input)
    card.querySelector('[data-enabled]').addEventListener('change', () => refreshCard(card));
    refreshCard(card);
  });

  document.getElementById('reset-order')?.addEventListener('click', () => {
    store.set('sectionOrder', [...defaultOrder]);
    syncOrder();
  });

  syncOrder();
}