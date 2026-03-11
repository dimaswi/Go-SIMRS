export function saveFormDraft(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

export function loadFormDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function savePendingCopy(section: string, data: unknown): void {
  try {
    localStorage.setItem(`mr-copy-${section}`, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

export function loadPendingCopy<T>(section: string): T | null {
  try {
    const raw = localStorage.getItem(`mr-copy-${section}`);
    if (!raw) return null;
    localStorage.removeItem(`mr-copy-${section}`);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearPendingCopy(section: string): void {
  try {
    localStorage.removeItem(`mr-copy-${section}`);
  } catch {
    // Ignore
  }
}
