/**
 * Cross-Browser, iOS Safari & Zalo/Facebook In-App WebView Safeguards
 * - Safe localStorage & sessionStorage wrappers with in-memory fallback
 * - Bulletproof clipboard copy with hidden <textarea> + document.execCommand('copy') fallback
 */

const memoryLocalStore = new Map<string, string>();
const memorySessionStore = new Map<string, string>();

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

function createSafeStorage(
  getNativeStorage: () => Storage | null,
  fallbackMap: Map<string, string>
): SafeStorage {
  return {
    getItem(key: string): string | null {
      try {
        const storage = getNativeStorage();
        if (storage) {
          const val = storage.getItem(key);
          if (val !== null) {
            fallbackMap.set(key, val);
            return val;
          }
        }
      } catch {
        // Ignore SecurityError / QuotaExceededError in strict WebViews or iOS Private Browsing
      }
      return fallbackMap.has(key) ? (fallbackMap.get(key) ?? null) : null;
    },

    setItem(key: string, value: string): void {
      fallbackMap.set(key, value);
      try {
        const storage = getNativeStorage();
        if (storage) {
          storage.setItem(key, value);
        }
      } catch {
        // Fallback to in-memory map already updated above
      }
    },

    removeItem(key: string): void {
      fallbackMap.delete(key);
      try {
        const storage = getNativeStorage();
        if (storage) {
          storage.removeItem(key);
        }
      } catch {
        // Ignore error in restricted WebViews
      }
    },

    clear(): void {
      fallbackMap.clear();
      try {
        const storage = getNativeStorage();
        if (storage) {
          storage.clear();
        }
      } catch {
        // Ignore error in restricted WebViews
      }
    },
  };
}

export const safeLocalStorage: SafeStorage = createSafeStorage(
  () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null),
  memoryLocalStore
);

export const safeSessionStorage: SafeStorage = createSafeStorage(
  () => (typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null),
  memorySessionStore
);

/**
 * Copies text to the clipboard safely across Desktop, Android, iOS Safari,
 * and Zalo / Facebook / Messenger In-App Browsers.
 * Uses navigator.clipboard.writeText first, then falls back to a hidden <textarea>
 * and document.execCommand('copy') when WebView permissions block the Clipboard API.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API first
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea execCommand('copy') for Zalo/Facebook WebViews
    }
  }

  // 2. Fallback: hidden <textarea> + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      // 16px prevents iOS Safari from auto-zooming when focusing the temporary textarea
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.width = '1px';
      textarea.style.height = '1px';
      textarea.style.fontSize = '16px';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';

      document.body.appendChild(textarea);

      const selection = document.getSelection();
      const savedRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      const succeeded = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (savedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }

      return succeeded;
    } catch {
      return false;
    }
  }

  return false;
}
