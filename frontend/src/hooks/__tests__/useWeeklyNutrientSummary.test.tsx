import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  buildWeeklyNutrient,
  useWeeklyNutrientSummary,
} from '../useWeeklyNutrientSummary';
import { nutritionApi } from '../../services/api/nutritionApi';

jest.mock('../../services/api/nutritionApi', () => ({
  nutritionApi: { getAllNutrients: jest.fn(), setNutrientTarget: jest.fn() },
}));

const mockApi = nutritionApi as jest.Mocked<typeof nutritionApi>;

const rawNutrient = (over: any = {}) => ({
  id: 'protein',
  name: 'Protein',
  unit: 'g',
  category: 'macro',
  value: 0,
  goal: 100,
  trend: [],
  ...over,
});

describe('buildWeeklyNutrient', () => {
  it('pads the trend to 7 and sums it for the amount', () => {
    const wn = buildWeeklyNutrient(rawNutrient({ trend: [10, 20, 30] }));
    expect(wn.trend).toHaveLength(7);
    expect(wn.amount).toBe(60);
  });

  it('falls back to dailyAvg*7 when no trend', () => {
    const wn = buildWeeklyNutrient(rawNutrient({ trend: [], value: 5 }));
    expect(wn.amount).toBe(35);
  });

  it('uses a weekly goal override when provided', () => {
    const wn = buildWeeklyNutrient(rawNutrient({ goal: 100 }), 999);
    expect(wn.goal).toBe(999);
  });

  it('derives the base weekly goal from customTarget or goal', () => {
    expect(buildWeeklyNutrient(rawNutrient({ goal: 100 })).goal).toBe(700);
    expect(
      buildWeeklyNutrient(rawNutrient({ goal: 100, customTarget: 50 })).goal,
    ).toBe(350);
  });
});

function renderHook() {
  const ref: { current: ReturnType<typeof useWeeklyNutrientSummary> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useWeeklyNutrientSummary();
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
  mockApi.getAllNutrients.mockResolvedValue([]);
  mockApi.setNutrientTarget.mockResolvedValue(undefined);
});
afterEach(() => errSpy.mockRestore());

describe('useWeeklyNutrientSummary', () => {
  it('fetches and builds the weekly nutrient list on mount', async () => {
    mockApi.getAllNutrients.mockResolvedValueOnce([
      rawNutrient({ id: 'protein', trend: [10, 10, 10] }),
    ]);
    const hook = renderHook();
    await act(async () => {});

    expect(mockApi.getAllNutrients).toHaveBeenCalled();
    expect(hook.current.allNutrients).toHaveLength(1);
    expect(hook.current.allNutrients[0].amount).toBe(30);
  });

  it('goNextWeek clamps at 0 (cannot go into the future)', async () => {
    const hook = renderHook();
    await act(async () => {});
    act(() => hook.current.goNextWeek());
    expect(hook.current.weekIdx).toBe(0);
    act(() => hook.current.goPrevWeek());
    expect(hook.current.weekIdx).toBe(-1);
  });

  it('handleSaveGoal saves the daily target and shows a toast', async () => {
    mockApi.getAllNutrients.mockResolvedValueOnce([
      rawNutrient({ id: 'fiber', name: 'Fiber', trend: [5, 5] }),
    ]);
    const hook = renderHook();
    await act(async () => {});

    act(() => hook.current.setGoalSheetId('fiber'));
    await act(async () => {
      await hook.current.handleSaveGoal(70); // weekly -> daily 10
    });

    expect(mockApi.setNutrientTarget).toHaveBeenCalledWith('fiber', 10);
    expect(hook.current.toast).toBe('Goal updated for Fiber');
  });
});
