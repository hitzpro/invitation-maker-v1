// Kelola koleksi SVG ornamen unggahan & sinkronisasi dropdown di Hiasan dekoratif.
export function initOrnaments({ store, invitationId, svgs }) {
  const root = document.querySelector('[data-ornaments]');
  const listContainer = document.querySelector('[data-list="decorations"] [data-items]');
  if (!root || !listContainer) return;

  const listEl = root.querySelector('[data-ornament-list]');
  const uploadInput = root.querySelector('[data-ornament-upload]');
  const msgEl = root.querySelector('[data-ornament-msg]');

  function syncSelects() {
    listContainer.querySelectorAll('[data-ornament-picker]').forEach((picker) => {
      const card = picker.closest('.space-y-2');
      const kindSelect = card?.querySelector('[data-bind$=".kind"]');
      const svgSelect = picker.querySelector('[data-ornament-select]');
      if (!kindSelect || !svgSelect) return;

      const path = svgSelect.dataset.bind;
      const current = store.get(path) ?? '';

      svgSelect.replaceChildren();
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = svgs.length ? '— Pilih SVG —' : '— Belum ada SVG —';
      svgSelect.append(empty);

      for (const s of svgs) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        svgSelect.append(opt);
      }
      svgSelect.value = svgs.some((s) => s.id === current) ? current : '';

      const showPicker = () => {
        const isCustom = kindSelect.value === 'custom';
        picker.classList.toggle('hidden', !isCustom);
        if (!isCustom && store.get(path)) store.set(path, null);
      };

      if (!kindSelect.dataset.ornBound) {
        kindSelect.dataset.ornBound = '1';
        kindSelect.addEventListener('change', showPicker);
        svgSelect.addEventListener('change', () => store.set(path, svgSelect.value || null));
      }
      showPicker();
    });
  }

  function renderList() {
    listEl.replaceChildren();
    if (svgs.length === 0) {
      const li = document.createElement('li');
      li.className = 'text-xs text-gray-500';
      li.textContent = 'Belum ada SVG diunggah.';
      listEl.append(li);
    }
    for (const s of svgs) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-2 rounded border bg-white px-2 py-1 text-xs';

      const name = document.createElement('span');
      name.className = 'truncate';
      name.textContent = s.name;

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Hapus';
      del.className = 'shrink-0 text-red-600 underline';
      del.addEventListener('click', async () => {
        const res = await fetch(`/api/invitations/${invitationId}/assets/${s.id}`, { method: 'DELETE' });
        if (!res.ok) return;
        const idx = svgs.findIndex((x) => x.id === s.id);
        if (idx >= 0) svgs.splice(idx, 1);
        renderList();
        syncSelects();
      });

      li.append(name, del);
      listEl.append(li);
    }
  }

  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    uploadInput.value = '';
    if (!file) return;

    msgEl.className = 'text-xs text-gray-600';
    msgEl.textContent = 'Mengunggah…';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/invitations/${invitationId}/ornaments`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengunggah SVG');
      svgs.push({ id: data.id, name: data.name });
      msgEl.textContent = '';
      renderList();
      syncSelects();
    } catch (err) {
      msgEl.className = 'text-xs text-red-600';
      msgEl.textContent = err.message;
    }
  });

  // Sinkronkan ulang setiap kali user menambah/menghapus item dekorasi
  new MutationObserver(syncSelects).observe(listContainer, { childList: true });
  renderList();
  syncSelects();
}