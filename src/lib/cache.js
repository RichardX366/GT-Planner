// Small persistence helpers. Everything here is best-effort: storage can be full,
// disabled, or cleared, and the app must still work (it just refetches).

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage unavailable */
  }
}

// The term catalog is ~2.5 MB of JSON, which is too close to localStorage's ~5 MB
// per-origin limit, so it lives in IndexedDB instead.
const DB_NAME = 'gt-planner';
const STORE = 'kv';
let dbPromise;

function db() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  return dbPromise;
}

export async function idbGet(key) {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const req = d.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet(key, value) {
  try {
    const d = await db();
    await new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage unavailable */
  }
}
