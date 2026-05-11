type CacheEnvelope<T> = {
  updatedAt: number;
  value: T;
};

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
    if (!parsed || typeof parsed.updatedAt !== 'number' || !('value' in parsed)) return null;
    return { updatedAt: parsed.updatedAt, value: parsed.value as T };
  } catch {
    return null;
  }
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  const envelope = readEnvelope<T>(key);
  if (!envelope) return null;
  if (Date.now() - envelope.updatedAt > maxAgeMs) return null;
  return envelope.value;
}

export function writeCache<T>(key: string, value: T): void {
  try {
    const envelope: CacheEnvelope<T> = { updatedAt: Date.now(), value };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore storage failures (private mode / quota)
  }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
