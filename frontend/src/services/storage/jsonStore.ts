import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKey } from './storageKeys';

/**
 * The read/write pair every persisted reminder store was hand-rolling.
 *
 * Six stores each had a private `readAll`/`writeAll`: getItem, JSON.parse, shape-check,
 * `[]` on any failure. The shape-check had drifted — rescheduleStore validated every
 * element while missedStore only checked `Array.isArray`, so one store rejected a corrupt
 * record and its neighbour happily persisted it. Here the element guard is mandatory, on
 * both read and write, which is a deliberate hardening: a record that does not satisfy
 * the guard is now dropped rather than kept.
 *
 * What stays per-store is what genuinely differs: whether a failure is logged, whether a
 * non-array value is cleared, and how many records to retain.
 */

export type ReadFailureReason = 'unreadable' | 'wrong-shape';

export interface JsonStoreOptions {
  /**
   * Reports a read that produced nothing usable. Stores pass their reminderLog warning;
   * omitting it makes corruption silent, which only processedActions wants.
   */
  onReadFailure?: (reason: ReadFailureReason, error?: unknown) => void;
  /**
   * Reports a failed write. When provided the failure is swallowed — appropriate for a
   * cache whose write must not break the flow that triggered it. When omitted the error
   * propagates to the caller.
   */
  onWriteFailure?: (error: unknown) => void;
  /** Remove the key outright when the stored value has the wrong shape. */
  clearWhenInvalid?: boolean;
}

export interface JsonArrayStoreOptions<T> extends JsonStoreOptions {
  /** Cap on retained records, applied on write. */
  max?: number;
  /** Ordering that decides which records the cap keeps — the last `max` survive. */
  order?: (a: T, b: T) => number;
}

export interface JsonArrayStore<T> {
  readAll(): Promise<T[]>;
  writeAll(items: T[]): Promise<void>;
  clear(): Promise<void>;
}

export interface JsonValueStore<T> {
  read(): Promise<T>;
  write(value: T): Promise<void>;
  clear(): Promise<void>;
}

async function readJson(
  key: StorageKey,
  options: JsonStoreOptions,
): Promise<unknown | undefined> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch (e) {
    options.onReadFailure?.('unreadable', e);
    return undefined;
  }
}

async function discard(key: StorageKey, options: JsonStoreOptions): Promise<void> {
  if (!options.clearWhenInvalid) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing useful to do: the value is already being treated as absent.
  }
}

async function writeJson(
  key: StorageKey,
  value: unknown,
  options: JsonStoreOptions,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (!options.onWriteFailure) throw e;
    options.onWriteFailure(e);
  }
}

/** A list of `T` under one key. Elements failing `guard` are dropped on read and write. */
export function createJsonArrayStore<T>(
  key: StorageKey,
  guard: (value: unknown) => value is T,
  options: JsonArrayStoreOptions<T> = {},
): JsonArrayStore<T> {
  const bound = (items: T[]): T[] => {
    const valid = items.filter(guard);
    if (options.max === undefined) return valid;
    const ordered = options.order ? [...valid].sort(options.order) : valid;
    return ordered.slice(-options.max);
  };

  return {
    async readAll() {
      const parsed = await readJson(key, options);
      if (parsed === undefined) return [];
      if (!Array.isArray(parsed)) {
        options.onReadFailure?.('wrong-shape');
        await discard(key, options);
        return [];
      }
      return parsed.filter(guard);
    },

    async writeAll(items: T[]) {
      await writeJson(key, bound(items), options);
    },

    async clear() {
      await AsyncStorage.removeItem(key);
    },
  };
}

/** A single `T` under one key, falling back to `fallback` whenever it is unusable. */
export function createJsonValueStore<T>(
  key: StorageKey,
  guard: (value: unknown) => value is T,
  fallback: () => T,
  options: JsonStoreOptions = {},
): JsonValueStore<T> {
  return {
    async read() {
      const parsed = await readJson(key, options);
      if (parsed === undefined) return fallback();
      if (!guard(parsed)) {
        options.onReadFailure?.('wrong-shape');
        await discard(key, options);
        return fallback();
      }
      return parsed;
    },

    async write(value: T) {
      await writeJson(key, value, options);
    },

    async clear() {
      await AsyncStorage.removeItem(key);
    },
  };
}
