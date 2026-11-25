const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function keysOf(path) {
  const keys = path.split('.');
  if (keys.some((k) => FORBIDDEN.has(k))) throw new Error('Path tidak valid');
  return keys;
}

export const getPath = (obj, path) =>
  keysOf(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function setPath(obj, path, value) {
  const keys = keysOf(path);
  const last = keys.pop();
  let target = obj;
  for (const k of keys) {
    if (target[k] == null || typeof target[k] !== 'object') throw new Error(`Path tidak ada: ${path}`);
    target = target[k];
  }
  target[last] = value;
}

// status: dirty | saving | saved | error | invalid | conflict
export function createStore({ invitationId, content, version, onStatus, onSaved, onErrors, onConflict }) {
  const url = `/api/invitations/${invitationId}/content`;
  const state = content;
  let currentVersion = version;
  let dirty = false;
  let saving = false;
  let queued = false;
  let locked = false;
  let timer = null;
  let retryTimer = null;

  const emit = (status) => onStatus?.(status);

  async function save() {
    if (locked) return;
    if (saving) {
      queued = true;
      return;
    }
    clearTimeout(timer);
    clearTimeout(retryTimer);
    saving = true;
    dirty = false;
    emit('saving');

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: state, version: currentVersion }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        currentVersion = data.version;
        onErrors?.({});
        onSaved?.();
        emit(dirty ? 'dirty' : 'saved');
      } else if (res.status === 409) {
        locked = true;
        emit('conflict');
        onConflict?.(data);
      } else if (res.status === 422) {
        dirty = true;
        onErrors?.(data.errors ?? {});
        emit('invalid');
      } else {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch {
      dirty = true;
      emit('error');
      retryTimer = setTimeout(save, 5000);
    } finally {
      saving = false;
      if (queued) {
        queued = false;
        save();
      }
    }
  }

  function schedule() {
    dirty = true;
    emit('dirty');
    clearTimeout(timer);
    timer = setTimeout(save, 800);
  }

  return {
    get: (path) => getPath(state, path),
    set(path, value) {
      setPath(state, path, value);
      schedule();
    },
    flush: () => dirty && save(),
    isDirty: () => dirty || saving,
    push(path, item) {
      const list = getPath(state, path);
      if (!Array.isArray(list)) throw new Error(`Bukan array: ${path}`);
      list.push(item);
      schedule();
    },
    removeAt(path, index) {
      const list = getPath(state, path);
      if (!Array.isArray(list)) throw new Error(`Bukan array: ${path}`);
      list.splice(index, 1);
      schedule();
    },
    move(path, from, to) {
      const list = getPath(state, path);
      if (!Array.isArray(list) || to < 0 || to >= list.length) return;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      schedule();
    },
  };
}