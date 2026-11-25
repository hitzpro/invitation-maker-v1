// Preview langsung dengan dua iframe bergantian, tanpa kedip dan dengan posisi gulir terjaga.

// id elemen section di template Classic
const SECTION_DOM_ID = {
  cover: 'cover',
  couple: 'couple',
  event: 'schedule',
  countdown: 'countdown',
  story: 'story',
  gallery: 'gallery',
  location: 'venue',
  rsvp: 'rsvp',
  wishes: 'wishes',
  closing: 'closing',
};

const DEVICE_WIDTHS = { full: '100%', tablet: '768px', phone: '390px' };
const LOAD_TIMEOUT_MS = 10_000;
const DEVICE_KEY = 'editor-preview-device';

export function initPreview({ invitationId }) {
  const frames = [...document.querySelectorAll('[data-frame]')];
  const wrap = document.getElementById('frame-wrap');
  const statusEl = document.getElementById('preview-status');
  const basePath = `/dashboard/invitations/${invitationId}/preview`;

  let active = frames[0];
  let loading = false;
  let pending = false;

  const setStatus = (text, isError = false) => {
    statusEl.textContent = text;
    statusEl.className = isError ? 'text-red-600' : 'text-gray-500';
  };

  // Menampilkan satu iframe dan menyembunyikan yang lain
  function show(frame) {
    for (const f of frames) {
      const on = f === frame;
      f.classList.toggle('z-10', on);
      f.classList.toggle('opacity-0', !on);
      f.classList.toggle('pointer-events-none', !on);
      f.setAttribute('aria-hidden', String(!on));
      f.tabIndex = on ? 0 : -1;
    }
    active = frame;
  }

  function refresh() {
    if (loading) {
      pending = true; // gabungkan pembaruan yang datang selama memuat
      return;
    }

    loading = true;
    setStatus('Memperbarui preview…');

    const next = frames.find((f) => f !== active);
    const prev = active;
    let finished = false;

    const finish = (ok, message = '') => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      next.removeEventListener('load', onLoad);
      loading = false;
      setStatus(ok ? '' : message, !ok);
      if (pending) {
        pending = false;
        refresh();
      }
    };

    const onLoad = () => {
      try {
        const win = next.contentWindow;
        // Dialihkan ke halaman lain (misalnya /login) berarti sesi berakhir
        if (win.location.pathname !== basePath) {
          return finish(false, 'Preview tidak dapat dimuat. Sesi mungkin berakhir, muat ulang halaman ini.');
        }
        // posisi gulir dibaca saat pertukaran agar yang terbaru yang dipakai
        const y = prev.contentWindow?.scrollY ?? 0;
        win.scrollTo({ top: y, left: 0, behavior: 'instant' });
        show(next);
        finish(true);
      } catch {
        finish(false, 'Preview gagal ditampilkan.');
      }
    };

    const timer = setTimeout(() => finish(false, 'Preview terlalu lama dimuat.'), LOAD_TIMEOUT_MS);
    next.addEventListener('load', onLoad);
    next.src = `${basePath}?embed=1&t=${Date.now()}`; // parameter t mencegah cache
  }

  // Gulir halus ke section yang sedang diedit (bila section itu sedang tampil)
  function scrollToSection(key) {
    const win = active.contentWindow;
    const el = active.contentDocument?.getElementById(SECTION_DOM_ID[key] ?? '');
    if (!el) return;
    if (key === 'cover') win.scrollTo({ top: 0, behavior: 'smooth' });
    else el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------- Pilihan lebar preview ----------
  const buttons = [...document.querySelectorAll('[data-device]')];

  function setDevice(name) {
    wrap.style.width = DEVICE_WIDTHS[name];
    wrap.classList.toggle('shadow-xl', name !== 'full');
    for (const b of buttons) {
      const on = b.dataset.device === name;
      b.classList.toggle('bg-black', on);
      b.classList.toggle('text-white', on);
      b.setAttribute('aria-pressed', String(on));
    }
    try {
      localStorage.setItem(DEVICE_KEY, name);
    } catch {
      // penyimpanan browser tidak tersedia: abaikan
    }
  }

  let saved = 'full';
  try {
    const value = localStorage.getItem(DEVICE_KEY);
    if (value && Object.hasOwn(DEVICE_WIDTHS, value)) saved = value;
  } catch {
    // abaikan
  }
  buttons.forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.device)));
  setDevice(saved);

  show(frames[0]);
  refresh(); // muat preview pertama

  return { refresh, scrollToSection };
}