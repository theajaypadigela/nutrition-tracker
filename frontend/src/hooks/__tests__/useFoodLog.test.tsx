import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useFoodLog } from '../useFoodLog';
import { foodLogApi } from '../../services/api/foodLogApi';
import { loadMealRescheduleTime } from '../../services/mealScheduler';
import { FoodItem } from '../../types/types';

jest.mock('../../services/api/foodLogApi', () => ({
  foodLogApi: { getLog: jest.fn(), updateEntry: jest.fn(), deleteEntry: jest.fn() },
}));
jest.mock('../../services/mealScheduler', () => ({
  loadMealRescheduleTime: jest.fn(() => Promise.resolve(null)),
}));

const mockApi = foodLogApi as jest.Mocked<typeof foodLogApi>;
const mockReschedule = loadMealRescheduleTime as jest.Mock;

const totals = {
  calories: 100,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 1,
  sugar: 2,
  sodium: 3,
};

function renderUseFoodLog(date = '2026-06-14') {
  const ref: { current: ReturnType<typeof useFoodLog> } = { current: null as any };
  function Harness() {
    ref.current = useFoodLog(date);
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

describe('useFoodLog', () => {
  it('reload populates meals + totals and the reschedule banner time', async () => {
    mockApi.getLog.mockResolvedValueOnce({
      meals: { breakfast: [{ id: '1', name: 'Egg' }] } as any,
      totals,
    });
    mockReschedule.mockResolvedValueOnce(1718000000000);
    const hook = renderUseFoodLog();

    await act(async () => {
      await hook.current.reload();
    });

    expect(mockApi.getLog).toHaveBeenCalledWith('2026-06-14');
    expect(hook.current.meals.breakfast).toHaveLength(1);
    expect(hook.current.nutritionTotals.calories).toBe(100);
    expect(hook.current.mealRescheduleTime).toBe(1718000000000);
  });

  it('saveFood updates the selected entry with a parsed quantity and applies the response', async () => {
    const hook = renderUseFoodLog();
    const item: FoodItem = {
      id: 'e1',
      name: 'Rice',
      quantity: '1',
      servingSize: '1 cup',
    };
    act(() => {
      hook.current.openEditor(item);
    });
    expect(hook.current.showDrawer).toBe(true);
    expect(hook.current.selectedFood?.id).toBe('e1');

    mockApi.updateEntry.mockResolvedValueOnce({
      meals: { lunch: [{ id: 'e1', name: 'Rice' }] } as any,
      totals,
    });
    await act(async () => {
      await hook.current.saveFood('Rice', '2.5', 'cup');
    });

    expect(mockApi.updateEntry).toHaveBeenCalledWith('2026-06-14', 'e1', {
      name: 'Rice',
      quantity: 2.5,
      unit: 'cup',
    });
    expect(hook.current.nutritionTotals.calories).toBe(100);
  });

  it('saveFood rethrows on failure (so the drawer can surface the error)', async () => {
    const hook = renderUseFoodLog();
    act(() => {
      hook.current.openEditor({
        id: 'e1',
        name: 'X',
        quantity: '1',
        servingSize: 'g',
      });
    });
    mockApi.updateEntry.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      await expect(hook.current.saveFood('X', '1', 'g')).rejects.toThrow('boom');
    });
  });

  it('deleteFood removes via the entry id and applies the response', async () => {
    const hook = renderUseFoodLog();
    mockApi.deleteEntry.mockResolvedValueOnce({
      meals: {} as any,
      totals,
    });
    await act(async () => {
      await hook.current.deleteFood('breakfast', 'e9');
    });
    expect(mockApi.deleteEntry).toHaveBeenCalledWith('e9');
    expect(hook.current.nutritionTotals.calories).toBe(100);
  });

  it('toggleMeal collapses the currently expanded slot', () => {
    const hook = renderUseFoodLog();
    expect(hook.current.expandedMeal).toBe('breakfast');
    act(() => {
      hook.current.toggleMeal('breakfast');
    });
    expect(hook.current.expandedMeal).toBeNull();
  });
});
