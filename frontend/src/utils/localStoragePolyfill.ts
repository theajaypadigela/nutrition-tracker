/**
 * localStorage polyfill for React Native
 * Some third-party SDKs (like Vapi) expect browser localStorage to exist.
 * This provides a synchronous in-memory shim that suppresses errors.
 */

const memoryStorage: Record<string, string> = {};

const localStoragePolyfill = {
  getItem: (key: string): string | null => {
    return memoryStorage[key] ?? null;
  },
  setItem: (key: string, value: string): void => {
    memoryStorage[key] = value;
  },
  removeItem: (key: string): void => {
    delete memoryStorage[key];
  },
  clear: (): void => {
    Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
  },
  get length(): number {
    return Object.keys(memoryStorage).length;
  },
  key: (index: number): string | null => {
    const keys = Object.keys(memoryStorage);
    return keys[index] ?? null;
  },
};

// Install polyfill if localStorage is not available
if (typeof global !== 'undefined' && !global.localStorage) {
  (global as any).localStorage = localStoragePolyfill;
}

export default localStoragePolyfill;
