// Pemilih lagu, unggah lagu, dan pratinjau di editor.
export function initMusic({ store, invitationId, tracks }) {
  const root = document.querySelector('[data-music]');
  if (!root) return;

  const list = root.querySelector('[data-music-list]');
  const preview = root.querySelector('[data-music-preview]');
  const none = root.querySelector('[data-music-none]');
  const clearBtn = root.querySelector('[data-music-clear]');
  const input = root.querySelector('[data-music-upload]');
  const message = root.querySelector('[data-music-msg]');

  function render() {
    const selected = store.get('music.assetId');
    const track = tracks.find((t) => t.id === selected);

    none.classList.toggle('hidden', Boolean(track));
    preview.classList.toggle('hidden', !track);
    clearBtn.classList.toggle('hidden', !track);
    if (track) {
      if (preview.getAttribute('src') !== track.url) preview.src = track.url;
    } else {
      preview.pause();
      preview.removeAttribute('src');
    }

    list.replaceChildren();
    if (tracks.length === 0) {
      const li = document.createElement('li');
      li.className = 'text-xs text-[#6C5E54]';
      li.textContent = 'Belum ada lagu diunggah.';
      list.append(li);
    }
    for (const t of tracks) {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-2 rounded-[8px] border border-[#D8C8B5] bg-[#FFFFFF] px-3 py-1.5 text-xs';

      const name = document.createElement('span');
      name.className = 'truncate text-[#493D35]';
      name.textContent = t.name;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t.id === selected ? 'Dipakai' : 'Pakai';
      btn.disabled = t.id === selected;
      btn.className =
        'shrink-0 rounded-[6px] border px-2.5 py-0.5 text-[11px] font-medium ' +
        (t.id === selected
          ? 'border-[#8B7561] bg-[#8B7561] text-white'
          : 'border-[#D8C8B5] bg-[#F5F0E8] text-[#493D35] hover:border-[#8B7561]');
      btn.addEventListener('click', () => {
        store.set('music.assetId', t.id);
        render();
      });

      li.append(name, btn);
      list.append(li);
    }
  }

  clearBtn.addEventListener('click', () => {
    store.set('music.assetId', null);
    render();
  });

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;

    message.className = 'mt-1.5 text-xs text-[#6C5E54]';
    message.textContent = 'Mengunggah…';

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/invitations/${invitationId}/audio`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengunggah');
      tracks.push({ id: data.id, name: data.name, url: data.url });
      store.set('music.assetId', data.id);
      message.textContent = '';
    } catch (err) {
      message.className = 'mt-1.5 text-xs text-[#A34E4E]';
      message.textContent = err.message;
    }
    render();
  });

  render();
}