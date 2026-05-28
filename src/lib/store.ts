const KEY = 'autodruck:v1';

export type Persisted = {
  printer?: string;
  stage?: number;
  globalDefaults?: unknown;
  customTemplates?: unknown;
  cost?: unknown;
};

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Persisted;
  } catch {
    return {};
  }
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // swallow quota / disabled storage
    console.warn('autodruck: localStorage write failed');
  }
}
