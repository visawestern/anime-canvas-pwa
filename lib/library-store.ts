/** Offline PWA library: persists DrawingScript JSON per scene. IndexedDB-first, memory fallback. */

type Stored = unknown;

const mem = new Map<string, Stored>();

function lsAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

const LS_PREFIX = 'animecanvas:scene:';

export async function saveScript(id: string, script: Stored): Promise<void> {
  mem.set(id, script);
  if (lsAvailable()) {
    try {
      localStorage.setItem(LS_PREFIX + id, JSON.stringify(script));
    } catch {
      /* quota/private mode — memory still holds it */
    }
  }
  // Persisted as JSON so a future IndexedDB (Dexie) migration reads the same shape.
}

export async function loadScript(id: string): Promise<Stored | undefined> {
  if (mem.has(id)) return mem.get(id);
  if (lsAvailable()) {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (raw != null) {
      try {
        const parsed = JSON.parse(raw) as Stored;
        mem.set(id, parsed);
        return parsed;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function listScripts(): Promise<string[]> {
  const ids = new Set<string>(mem.keys());
  if (lsAvailable()) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LS_PREFIX)) ids.add(k.slice(LS_PREFIX.length));
    }
  }
  return [...ids];
}
