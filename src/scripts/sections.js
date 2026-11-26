function hasSectionData(store, key) {
  if (key === 'cover' || key === 'rsvp' || key === 'wishes' || key === 'closing') return true;
  if (key === 'couple') {
    const b = store.get('sections.couple.bride');
    const g = store.get('sections.couple.groom');
    return Boolean((b?.name?.trim() || b?.fullName?.trim()) && (g?.name?.trim() || g?.fullName?.trim()));
  }
  if (key === 'event' || key === 'countdown') {
    const items = store.get('sections.event.items') ?? [];
    return items.some((ev) => /^\d{4}-\d{2}-\d{2}$/.test(ev?.date ?? ''));
  }
  if (key === 'story') return (store.get('sections.story.items') ?? []).length > 0;
  if (key === 'gallery') return (store.get('sections.gallery.imageIds') ?? []).length > 0;
  if (key === 'location') return Boolean(store.get('sections.location.venueName')?.trim());
  if (key === 'gift') {
    const accounts = store.get('sections.gift.accounts') ?? [];
    return accounts.some((a) => a?.bank?.trim() && a?.number?.trim()) || Boolean(store.get('sections.gift.qrisImageId'));
  }
  return true;
}

// Pengaturan aktif/nonaktif, pemilihan panel properti, dan pengurutan section di panel struktur.
export function initSections({ store, onSelectSection }) {
  const container = document.getElementById('sections');
  const defaultOrder = JSON.parse(container.dataset.defaultOrder);
  const cardOf = (key) => container.querySelector(`:scope > [data-section="${key}"]`);

  function refreshCard(card) {
    const key = card.dataset.section;
    const enabled = Boolean(store.get(`sections.${key}.enabled`));
    const ready = hasSectionData(store, key);
    card.classList.toggle('opacity-75', !enabled);
    card.querySelector('[data-card-title]').classList.toggle('text-[#6C5E54]', !enabled);
    card.querySelector('[data-badge-off]')?.classList.toggle('hidden', enabled);
    card.querySelector('[data-badge-empty]')?.classList.toggle('hidden', !enabled || ready);
  }

  function refreshBadges() {
    container.querySelectorAll(':scope > [data-section]').forEach(refreshCard);
  }

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
    const toggle = card.querySelector('[data-card-toggle]');
    const editBtn = card.querySelector('[data-open-prop]');
    const up = card.querySelector('[data-move-up]');
    const down = card.querySelector('[data-move-down]');

    const selectThis = () => onSelectSection?.(key);

    toggle?.addEventListener('click', selectThis);
    editBtn?.addEventListener('click', selectThis);

    up?.addEventListener('click', () => {
      move(key, -1);
      up.focus();
    });
    down?.addEventListener('click', () => {
      move(key, 1);
      down.focus();
    });

    card.querySelector('[data-enabled]').addEventListener('change', () => refreshCard(card));
    refreshCard(card);
  });

  document.getElementById('reset-order')?.addEventListener('click', () => {
    store.set('sectionOrder', [...defaultOrder]);
    syncOrder();
  });

  syncOrder();
  return { refreshBadges };
}