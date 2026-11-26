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
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

const STATUS = {
  dirty: ['Perubahan belum disimpan…', 'font-medium text-[#6C5E54]'],
  saving: ['Menyimpan…', 'font-medium text-[#6C5E54]'],
  saved: ['Tersimpan', 'font-medium text-[#58765D]'],
  error: ['Gagal menyimpan, mencoba lagi…', 'font-medium text-[#A34E4E]'],
  invalid: ['Ada isian belum valid', 'font-medium text-[#A34E4E]'],
  conflict: ['Konflik versi', 'font-medium text-[#A34E4E]'],
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
  onSaved: () => {
    preview.refresh();
    sectionsCtrl?.refreshBadges();
  },
  onErrors: showErrors,
  onConflict: () => conflictEl.classList.remove('hidden'),
  onRestore: () => syncAll(),
});

// ---------- Two-way bindings ----------
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
      sectionsCtrl?.refreshBadges();
    });
  });
}
const bindAll = syncBindings;

bindAll(document);
initFonts({ store });
initTheme({ store });
initPhotos({ store, invitationId, assets });
initMusic({ store, invitationId, tracks: audio });

// Preset swatch colors
const colorInput = document.querySelector('[data-bind="theme.primaryColor"]');
document.querySelectorAll('[data-color-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.colorPreset;
    colorInput.value = value;
    store.set('theme.primaryColor', value);
    updateHistoryButtons();
  });
});

// ---------- 3-Panel Active Property & Mobile Tab Management ----------
const paneStructure = document.getElementById('pane-structure');
const paneProperties = document.getElementById('pane-properties');
const panePreview = document.getElementById('pane-preview');
const mobileTabs = [...document.querySelectorAll('[data-tab]')];
const propPanels = [...document.querySelectorAll('[data-prop-panel]')];
const globalPicks = [...document.querySelectorAll('[data-panel-pick]')];
const sectionCards = [...document.querySelectorAll('#sections > [data-section]')];

function setMobileTab(tab) {
  paneStructure?.classList.toggle('hidden', tab !== 'structure');
  paneProperties?.classList.toggle('hidden', tab !== 'properties');
  panePreview?.classList.toggle('hidden', tab !== 'preview');
  mobileTabs.forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('border-[#8B7561]', on);
    b.classList.toggle('border-transparent', !on);
    b.classList.toggle('font-medium', on);
    b.classList.toggle('text-[#493D35]', on);
    b.classList.toggle('text-[#6C5E54]', !on);
  });
}

mobileTabs.forEach((btn) => {
  btn.addEventListener('click', () => setMobileTab(btn.dataset.tab));
});

let lastFocusedSection = null;
function activatePanel(panelKey, { switchMobile = false } = {}) {
  propPanels.forEach((p) => {
    p.classList.toggle('hidden', p.dataset.propPanel !== panelKey);
  });

  globalPicks.forEach((btn) => {
    const on = btn.dataset.panelPick === panelKey;
    btn.classList.toggle('border-[#8B7561]', on);
    btn.classList.toggle('bg-[#F5F0E8]', on);
    btn.classList.toggle('border-[#D8C8B5]', !on);
    btn.classList.toggle('bg-[#FFFFFF]', !on);
  });

  sectionCards.forEach((card) => {
    const on = card.dataset.section === panelKey;
    card.classList.toggle('border-[#8B7561]', on);
    card.classList.toggle('bg-[#F5F0E8]/60', on);
    card.classList.toggle('border-[#D8C8B5]', !on);
    card.classList.toggle('bg-[#FFFFFF]', !on);
  });

  if (!panelKey.startsWith('global-') && panelKey !== lastFocusedSection) {
    lastFocusedSection = panelKey;
    preview.scrollToSection(panelKey);
  }

  if (switchMobile && window.innerWidth < 1024) {
    setMobileTab('properties');
  }
  paneProperties?.scrollTo({ top: 0, behavior: 'instant' });
}

globalPicks.forEach((btn) => {
  btn.addEventListener('click', () => activatePanel(btn.dataset.panelPick, { switchMobile: true }));
});

const sectionsCtrl = initSections({
  store,
  onSelectSection(key) {
    activatePanel(key, { switchMobile: true });
  },
});

activatePanel('global-theme');

// ---------- Dynamic Lists (events, stories, gifts, decorations) ----------
function initList(container) {
  const path = container.dataset.list;
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
        showErrors({});
        render();
        updateHistoryButtons();
        sectionsCtrl?.refreshBadges();
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
    sectionsCtrl?.refreshBadges();
  });

  render();
  container._rerender = render;
}
document.querySelectorAll('[data-list]').forEach(initList);
initOrnaments({ store, invitationId, svgs });

// ---------- Copy location from first event ----------
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
  sectionsCtrl?.refreshBadges();
});

document.getElementById('reload-btn')?.addEventListener('click', () => location.reload());

// ---------- Unsaved changes protection ----------
window.addEventListener('beforeunload', (e) => {
  if (store.isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
});
document.querySelectorAll('header a').forEach((link) => {
  link.addEventListener('pointerdown', () => store.flush());
  link.addEventListener('click', () => store.flush());
});

// ---------- Undo / Redo ----------
function updateHistoryButtons() {
  if (undoBtn) undoBtn.disabled = !store.canUndo();
  if (redoBtn) redoBtn.disabled = !store.canRedo();
}

function syncAll() {
  document.querySelectorAll('[data-list]').forEach((c) => c._rerender?.());
  syncBindings(document);
  updateHistoryButtons();
  sectionsCtrl?.refreshBadges();
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