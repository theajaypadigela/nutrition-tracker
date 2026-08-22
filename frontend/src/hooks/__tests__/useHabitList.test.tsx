import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useHabitList } from '../useHabitList';
import { habitApi } from '../../services/api/habitApi';
import { cancelHabitReminder } from '../../services/notifications/reminderService';
import { Habit } from '../../types/types';

jest.mock('../../services/api/habitApi', () => ({
  habitApi: { getToday: jest.fn(), toggle: jest.fn(), remove: jest.fn() },
}));
jest.mock('../../services/notifications/reminderService', () => ({
  cancelHabitReminder: jest.fn(() => Promise.resolve()),
}));

const mockApi = habitApi as jest.Mocked<typeof habitApi>;

const habit = (over: Partial<Habit>): Habit => ({
  id: 'h',
  name: 'Habit',
  completed: false,
  repeatDays: [],
  reminderTime: '08:00 AM',
  reminderType: 'notification',
  ...over,
});

function renderUseHabitList() {
  const ref: { current: ReturnType<typeof useHabitList> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useHabitList();
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref;
}

let errSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errSpy.mockRestore());

describe('useHabitList', () => {
  it('fetches habits and derives progress', async () => {
    mockApi.getToday.mockResolvedValueOnce([
      habit({ id: '1', completed: true }),
      habit({ id: '2', completed: false }),
    ]);
    const hook = renderUseHabitList();

    await act(async () => {
      await hook.current.fetchHabits();
    });

    expect(hook.current.habits).toHaveLength(2);
    expect(hook.current.completedHabits).toBe(1);
    expect(hook.current.progressPercent).toBe(50);
    expect(hook.current.isInitialLoad).toBe(false);
    expect(hook.current.loading).toBe(false);
  });

  it('toggle flips optimistically and rolls back when the server rejects', async () => {
    mockApi.getToday.mockResolvedValueOnce([habit({ id: '1', completed: false })]);
    const hook = renderUseHabitList();
    await act(async () => {
      await hook.current.fetchHabits();
    });

    mockApi.toggle.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await hook.current.toggleHabit('1');
    });

    expect(mockApi.toggle).toHaveBeenCalledWith('1');
    expect(hook.current.habits[0].completed).toBe(false); // rolled back
  });

  it('delete removes optimistically + cancels the reminder on success', async () => {
    mockApi.getToday.mockResolvedValueOnce([
      habit({ id: '1' }),
      habit({ id: '2' }),
    ]);
    const hook = renderUseHabitList();
    await act(async () => {
      await hook.current.fetchHabits();
    });

    mockApi.remove.mockResolvedValueOnce({});
    await act(async () => {
      await hook.current.deleteHabit('1');
    });

    expect(mockApi.remove).toHaveBeenCalledWith('1');
    expect(cancelHabitReminder).toHaveBeenCalledWith('1');
    expect(hook.current.habits.map(h => h.id)).toEqual(['2']);
  });

  it('delete rolls back and alerts when the server rejects', async () => {
    mockApi.getToday.mockResolvedValueOnce([
      habit({ id: '1' }),
      habit({ id: '2' }),
    ]);
    const hook = renderUseHabitList();
    await act(async () => {
      await hook.current.fetchHabits();
    });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockApi.remove.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await hook.current.deleteHabit('1');
    });

    expect(hook.current.habits.map(h => h.id)).toEqual(['1', '2']); // restored
    expect(alertSpy).toHaveBeenCalled();
    expect(cancelHabitReminder).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
