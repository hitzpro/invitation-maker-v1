import { createStore } from './store.js';
import { initPhotos } from './photos.js';
import { initSections } from './sections.js';
import { initPreview } from './preview.js';
import { initTheme } from './theme.js';
import { initFonts } from './fonts.js';
import { initMusic } from './music.js';
import { initOrnaments } from './ornaments.js';

const { invitationId, content, version, assets, audio, svgs = [] } = JSON.parse(
  document.getElementById('editor-data').textContent
);

const statusEl = document.getElementById('save-status');
const conflictEl = document.getElementById('conflict-banner');
const summaryEl = document.getElementById('error-summary');

const STATUS = {
  dirty: ['Perubahan belum disimpan…', 'text-gray-600'],
  saving: ['Menyimpan…', 'text-gray-600'],
  saved: ['Tersimpan', 'text-green-700'],
  error: ['Gagal menyimpan, mencoba lagi…', 'text-red-600'],
  invalid: ['Ada isian yang belum valid', 'text-red-600'],
  conflict: ['Konflik versi', 'text-red-600'],
};

function showErrors(errors) {
  document.querySelectorAll('[data-error-for]').forEach((el) => (el.textContent = ''));
  summaryEl.replaceChildren();

  const unmatched = [];
  for (const [path, message] of Object.entries(errors)) {
    const el = document.querySelector(`[data-error-for="${CSS.escape(path)}"]`);
    if (el) el.textContent = message;
    else unmatched.push(`${path}: ${message}`);
  }

  for (const line of unmatched) {
    const li = document.createElement('li');
    li.textContent = line;
    summaryEl.append(li);
  }
  summaryEl.classList.toggle('hidden', unmatched.length === 0);
}

const preview = initPreview({ invitationId });

const store = createStore({
  invitationId,
  content,
  version,
  onStatus(status) {
    const [label, color] = STATUS[status];
    statusEl.textContent = label;
    statusEl.className = color;
  },
  onSaved: () => preview.refresh(),
  onErrors: showErrors,
  onConflict: () => conflictEl.classList.remove('hidden'),
  onRestore: () => syncAll(),
});

// ---------- Pengikatan dua arah: <input data-bind="sections.cover.heading"> ----------
function syncBindings(root = document) {
  root.querySelectorAll('[data-bind]').forEach((el) => {
    const path = el.dataset.bind;
    const value = store.get(path);
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value ?? '';

    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('input', () => {
      const raw = el.type === 'checkbox' ? el.checked : el.value;
      store.set(path, el.dataset.type === 'number' ? Number(raw) : raw);
      updateHistoryButtons();
    });
  });
}
const bindAll = syncBindings;

bindAll(document);
initFonts({ store });
initTheme({ store });

initPhotos({ store, invitationId, assets });
initMusic({ store, invitationId, tracks: audio });

// Swatch warna siap pakai
const colorInput = document.querySelector('[data-bind="theme.primaryColor"]');
document.querySelectorAll('[data-color-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.colorPreset;
    colorInput.value = value;
    store.set('theme.primaryColor', value);
    updateHistoryButtons();
  });
});

// Preview mengikuti section yang sedang diedit (sekali per perpindahan section)
let lastFocusedSection = null;
initSections({
  store,
  onFocusSection(key) {
    if (key === lastFocusedSection) return;
    lastFocusedSection = key;
    preview.scrollToSection(key);
  },
});

// ---------- Daftar dinamis (acara, cerita) ----------
function initList(container) {
  const path = container.dataset.list; // contoh: sections.event.items
  const max = Number(container.dataset.max);
  const blank = JSON.parse(container.dataset.blank);
  const template = container.querySelector('template');
  const itemsEl = container.querySelector('[data-items]');
  const addBtn = container.querySelector('[data-add-item]');
  const emptyEl = container.querySelector('[data-empty]');

  function render() {
    itemsEl.replaceChildren();
    const items = store.get(path);

    items.forEach((_, i) => {
      const fragment = template.content.cloneNode(true);

      // ganti penanda __i__ dengan nomor urut pada semua atribut (data-bind, id, for, dst.)
      fragment.querySelectorAll('*').forEach((el) => {
        for (const attr of [...el.attributes]) {
          if (attr.value.includes('__i__')) el.setAttribute(attr.name, attr.value.replaceAll('__i__', i));
        }
      });

      const number = fragment.querySelector('[data-item-number]');
      if (number) number.textContent = String(i + 1);

      bindAll(fragment);

      fragment.querySelector('[data-remove-item]').addEventListener('click', () => {
        store.removeAt(path, i);
        showErrors({}); // pesan error lama merujuk indeks yang sudah bergeser
        render();
        updateHistoryButtons();
      });

      itemsEl.append(fragment);
    });

    addBtn.disabled = items.length >= max;
    emptyEl?.classList.toggle('hidden', items.length > 0);
  }

  addBtn.addEventListener('click', () => {
    store.push(path, structuredClone(blank));
    render();
    updateHistoryButtons();
  });

  render();
  container._rerender = render;
}
document.querySelectorAll('[data-list]').forEach(initList);
initOrnaments({ store, invitationId, svgs });

// ---------- Salin lokasi dari acara pertama ----------
document.querySelector('[data-action="copy-location"]')?.addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const first = store.get('sections.event.items')[0];

  if (!first) {
    const original = btn.textContent;
    btn.textContent = 'Belum ada acara';
    setTimeout(() => (btn.textContent = original), 1500);
    return;
  }

  const values = {
    'sections.location.venueName': first.venue,
    'sections.location.address': first.address,
  };
  for (const [path, value] of Object.entries(values)) {
    store.set(path, value);
    const input = document.querySelector(`[data-bind="${CSS.escape(path)}"]`);
    if (input) input.value = value;
  }
  updateHistoryButtons();
});

document.getElementById('reload-btn')?.addEventListener('click', () => location.reload());

// ---------- Jangan kehilangan perubahan saat menutup tab ----------
window.addEventListener('beforeunload', (e) => {
  if (store.isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
});

// ---------- Tab Edit / Preview untuk layar kecil ----------
const paneEdit = document.getElementById('pane-edit');
const panePreview = document.getElementById('pane-preview');
document.querySelectorAll('[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    paneEdit.classList.toggle('hidden', tab !== 'edit');
    panePreview.classList.toggle('hidden', tab !== 'preview');
    document.querySelectorAll('[data-tab]').forEach((b) => {
      b.classList.toggle('border-b-2', b === btn);
      b.classList.toggle('border-black', b === btn);
      b.classList.toggle('font-medium', b === btn);
    });
  });
});

// ---------- Undo / Redo ----------
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

function updateHistoryButtons() {
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
}

function syncAll() {
  document.querySelectorAll('[data-list]').forEach((c) => c._rerender?.());
  syncBindings(document);
  updateHistoryButtons();
}

undoBtn?.addEventListener('click', () => store.undo());
redoBtn?.addEventListener('click', () => store.redo());

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (store.undo()) e.preventDefault();
  } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
    if (store.redo()) e.preventDefault();
  }
});