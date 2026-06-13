import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../../api/client';
import {
  loadHabitsCached,
  saveHabitsCached,
  upsertHabitCached,
  removeHabitCached,
  clearHabitsCached,
  fetchHabitsFromServer,
} from '../habitStore';
import { Habit } from '../../../types/types';

jest.mock('../../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockGet = (apiClient as unknown as { get: jest.Mock }).get;

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Drink water',
    completed: false,
    repeatDays: ['Mon', 'Wed', 'Fri'],
    reminderTime: '08:00 AM',
    reminderType: 'notification',
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGet.mockReset();
});

describe('habitStore cache', () => {
  it('returns an empty array when nothing is cached', async () => {
    expect(await loadHabitsCached()).toEqual([]);
  });

  it('round-trips a saved habit set and drops malformed entries', async () => {
    await saveHabitsCached([
      habit({ id: 'a' }),
      { id: 'bad' } as unknown as Habit, // missing required fields -> filtered out
      habit({ id: 'b', reminderType: 'call' }),
    ]);
    const loaded = await loadHabitsCached();
    expect(loaded.map(h => h.id)).toEqual(['a', 'b']);
  });

  it('upsert inserts then replaces by id (no duplicates)', async () => {
    await upsertHabitCached(habit({ id: 'a', name: 'First' }));
    await upsertHabitCached(habit({ id: 'b', name: 'Second' }));
    await upsertHabitCached(habit({ id: 'a', name: 'First-edited' }));
    const loaded = await loadHabitsCached();
    expect(loaded).toHaveLength(2);
    expect(loaded.find(h => h.id === 'a')?.name).toBe('First-edited');
  });

  it('remove deletes the matching habit only', async () => {
    await saveHabitsCached([habit({ id: 'a' }), habit({ id: 'b' })]);
    await removeHabitCached('a');
    expect((await loadHabitsCached()).map(h => h.id)).toEqual(['b']);
  });

  it('clear empties the cache', async () => {
    await saveHabitsCached([habit({ id: 'a' })]);
    await clearHabitsCached();
    expect(await loadHabitsCached()).toEqual([]);
  });

  it('treats a corrupt (non-array) cached value as empty', async () => {
    await AsyncStorage.setItem('habit_definitions_v1', JSON.stringify({ not: 'an array' }));
    expect(await loadHabitsCached()).toEqual([]);
  });
});

describe('fetchHabitsFromServer', () => {
  it('returns server habits and refreshes the cache on success', async () => {
    mockGet.mockResolvedValue({ data: [habit({ id: 'srv' })] });
    const result = await fetchHabitsFromServer();
    expect(result?.map(h => h.id)).toEqual(['srv']);
    // Cache was refreshed from the authoritative fetch.
    expect((await loadHabitsCached()).map(h => h.id)).toEqual(['srv']);
  });

  it('filters malformed server entries before caching', async () => {
    mockGet.mockResolvedValue({
      data: [habit({ id: 'ok' }), { id: 'bad' }],
    });
    const result = await fetchHabitsFromServer();
    expect(result?.map(h => h.id)).toEqual(['ok']);
  });

  it('treats a non-array 2xx body as an authoritative empty set', async () => {
    await saveHabitsCached([habit({ id: 'stale' })]);
    mockGet.mockResolvedValue({ data: null });
    const result = await fetchHabitsFromServer();
    expect(result).toEqual([]);
    expect(await loadHabitsCached()).toEqual([]);
  });

  it('returns null on failure and leaves the cache intact for fallback', async () => {
    await saveHabitsCached([habit({ id: 'cached' })]);
    mockGet.mockRejectedValue(new Error('network down'));
    const result = await fetchHabitsFromServer();
    expect(result).toBeNull();
    // The cache is preserved so reconciliation can fall back to it.
    expect((await loadHabitsCached()).map(h => h.id)).toEqual(['cached']);
  });
});
