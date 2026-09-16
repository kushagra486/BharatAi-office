const STORAGE_KEY = 'bharat-ai-office-token';

// Wrapped in try/catch throughout: localStorage can throw (private
// browsing, disabled storage) and this is a per-viewer convenience, not
// state anything server-side depends on — a failed read/write just means
// the login screen shows again, not a crash.
export function getToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
