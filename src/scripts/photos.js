// Dialog pemilih foto bersama + field foto tunggal + pengelola galeri.
// `assets` adalah array yang dimutasi saat ada unggahan baru: { id, name, thumb }.
export function initPhotos({ store, invitationId, assets }) {
  const dialog = document.getElementById('photo-picker');
  const grid = dialog.querySelector('[data-picker-grid]');
  const titleEl = dialog.querySelector('[data-picker-title]');
  const emptyEl = dialog.querySelector('[data-picker-empty]');
  const confirmBtn = dialog.querySelector('[data-picker-confirm]');
  const uploadInput = dialog.querySelector('[data-picker-upload]');
  const messageEl = dialog.querySelector('[data-picker-msg]');

  const byId = (id) => assets.find((a) => a.id === id);

  let mode = 'single';
  let limit = Infinity;
  let highlighted = new Set(); // foto yang sedang dipakai (mode tunggal)
  let excluded = new Set(); // foto yang disembunyikan dari daftar (mode galeri)
  let selection = new Set(); // pilihan saat ini (mode galeri), urutan klik dipertahankan
  let resolver = null;

  function finish(result) {
    const resolve = resolver;
    resolver = null;
    resolve?.(result);
    dialog.close();
  }

  function updateConfirm() {
    confirmBtn.textContent = `Tambahkan${selection.size ? ` (${selection.size})` : ''}`;
    confirmBtn.disabled = selection.size === 0;
  }

  function renderGrid() {
    grid.replaceChildren();
    const visible = assets.filter((a) => !excluded.has(a.id));
    emptyEl.classList.toggle('hidden', visible.length > 0);

    for (const asset of visible) {
      const active = mode === 'single' ? highlighted.has(asset.id) : selection.has(asset.id);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'relative aspect-square overflow-hidden rounded border-2 ' +
        (active ? 'border-black' : 'border-transparent hover:border-gray-300');

      const img = document.createElement('img');
      img.src = asset.thumb;
      img.alt = asset.name;
      img.loading = 'lazy';
      img.className = 'h-full w-full object-cover';
      btn.append(img);

      if (active) {
        const badge = document.createElement('span');
        badge.textContent = '✓';
        badge.className =
          'absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black text-xs text-white';
        btn.append(badge);
      }

      btn.addEventListener('click', () => {
        if (mode === 'single') return finish([asset.id]);
        if (selection.has(asset.id)) selection.delete(asset.id);
        else if (selection.size < limit) selection.add(asset.id);
        renderGrid();
        updateConfirm();
      });
      grid.append(btn);
    }
  }

  // Mengembalikan Promise<string[] | null> (null bila dibatalkan)
  function open(options) {
    mode = options.mode;
    limit = options.limit ?? Infinity;
    highlighted = new Set(options.selected ?? []);
    excluded = new Set(options.exclude ?? []);
    selection = new Set();
    titleEl.textContent = options.title;
    messageEl.textContent = '';
    confirmBtn.classList.toggle('hidden', mode === 'single');
    updateConfirm();
    renderGrid();
    dialog.showModal();
    return new Promise((resolve) => (resolver = resolve));
  }

  dialog.addEventListener('close', () => {
    resolver?.(null); // ditutup lewat Esc
    resolver = null;
  });
  dialog.querySelector('[data-picker-cancel]').addEventListener('click', () => dialog.close());
  confirmBtn.addEventListener('click', () => finish([...selection]));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // klik latar
  });

  // Unggah foto baru langsung dari dialog
  uploadInput.addEventListener('change', async () => {
    const files = [...uploadInput.files];
    uploadInput.value = '';
    const errors = [];

    for (const [i, file] of files.entries()) {
      messageEl.className = 'mt-1 text-xs text-gray-600';
      messageEl.textContent = `Mengunggah ${i + 1}/${files.length}…`;

      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch(`/api/invitations/${invitationId}/assets`, { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Gagal mengunggah');
        assets.push({ id: data.id, name: file.name, thumb: `${data.url}?w=480` });
        renderGrid();
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    messageEl.className = 'mt-1 text-xs text-red-600';
    messageEl.textContent = errors.join(' | ');
  });

  // ---------- Field foto tunggal (cover, foto mempelai) ----------
  document.querySelectorAll('[data-photo-field]').forEach((el) => {
    const path = el.dataset.photoField;
    const thumb = el.querySelector('[data-photo-thumb]');
    const emptyMark = el.querySelector('[data-photo-empty]');
    const clearBtn = el.querySelector('[data-photo-clear]');

    function render() {
      const asset = byId(store.get(path));
      thumb.classList.toggle('hidden', !asset);
      emptyMark.classList.toggle('hidden', Boolean(asset));
      clearBtn.classList.toggle('hidden', !asset);
      if (asset) {
        thumb.src = asset.thumb;
        thumb.alt = asset.name;
      }
    }

    el.querySelector('[data-photo-pick]').addEventListener('click', async () => {
      const current = store.get(path);
      const result = await open({
        mode: 'single',
        title: el.dataset.label,
        selected: current ? [current] : [],
      });
      if (result) {
        store.set(path, result[0]);
        render();
      }
    });

    clearBtn.addEventListener('click', () => {
      store.set(path, null);
      render();
    });

    render();
  });

  // ---------- Galeri ----------
  document.querySelectorAll('[data-photo-gallery]').forEach((el) => {
    const path = el.dataset.photoGallery;
    const max = Number(el.dataset.max);
    const list = el.querySelector('[data-gallery-items]');
    const emptyNote = el.querySelector('[data-gallery-empty]');
    const addBtn = el.querySelector('[data-gallery-add]');

    const makeButton = (label, ariaLabel, onClick, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', ariaLabel);
      b.disabled = disabled;
      b.className = 'h-6 w-6 rounded bg-white/90 text-xs shadow disabled:opacity-30';
      b.addEventListener('click', onClick);
      return b;
    };

    function render() {
      const ids = store.get(path);
      list.replaceChildren();

      ids.forEach((id, i) => {
        const asset = byId(id);
        const li = document.createElement('li');
        li.className = 'relative aspect-square overflow-hidden rounded border bg-gray-100';

        if (asset) {
          const img = document.createElement('img');
          img.src = asset.thumb;
          img.alt = asset.name;
          img.loading = 'lazy';
          img.className = 'h-full w-full object-cover';
          li.append(img);
        }

        const bar = document.createElement('div');
        bar.className = 'absolute inset-x-1 bottom-1 flex justify-between gap-1';
        const move = (to) => () => {
          store.move(path, i, to);
          render();
        };
        bar.append(
          makeButton('←', 'Geser ke kiri', move(i - 1), i === 0),
          makeButton('✕', 'Hapus dari galeri', () => {
            store.removeAt(path, i);
            render();
          }),
          makeButton('→', 'Geser ke kanan', move(i + 1), i === ids.length - 1)
        );
        li.append(bar);
        list.append(li);
      });

      addBtn.disabled = ids.length >= max;
      emptyNote.classList.toggle('hidden', ids.length > 0);
    }

    addBtn.addEventListener('click', async () => {
      const current = store.get(path);
      const result = await open({
        mode: 'multi',
        title: 'Tambah foto galeri',
        exclude: current,
        limit: max - current.length,
      });
      if (result?.length) {
        result.forEach((id) => store.push(path, id));
        render();
      }
    });

    render();
  });
  // ---------- Pratinjau posisi foto mempelai ----------
  document.querySelectorAll('[data-photo-pos]').forEach((box) => {
    const prefix = box.dataset.photoPos;
    const field = box.parentElement?.querySelector(`[data-photo-field="${prefix}.photoId"]`);
    const thumb = field?.querySelector('[data-photo-thumb]');
    if (!thumb) return;

    const syncPos = () => {
      const x = store.get(`${prefix}.photoPos.x`) ?? 50;
      const y = store.get(`${prefix}.photoPos.y`) ?? 50;
      thumb.style.objectPosition = `${x}% ${y}%`;
    };
    box.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', syncPos));
    syncPos();
  });


}