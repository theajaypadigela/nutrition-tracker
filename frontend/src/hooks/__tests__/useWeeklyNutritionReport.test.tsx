import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useWeeklyNutritionReport } from '../useWeeklyNutritionReport';
import { nutritionApi } from '@/services/api/nutritionApi';

jest.mock('@/services/api/nutritionApi', () => ({
  nutritionApi: {
    getWeeklyReport: jest.fn(),
    getAllNutrients: jest.fn(),
    getInsights: jest.fn(),
  },
}));

const mockApi = nutritionApi as jest.Mocked<typeof nutritionApi>;

const totals = (over: Partial<Record<string, number>> = {}) => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
  ...over,
});

const reportWith = (weeklyTotals: any, weeklyAverage: any = totals()) => ({
  avgDailyCalories: 0,
  weeklyTotals,
  weeklyAverage,
  dailySummaries: [],
});

function renderHook() {
  const ref: { current: ReturnType<typeof useWeeklyNutritionReport> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useWeeklyNutritionReport();
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
  mockApi.getInsights.mockResolvedValue([]);
});
afterEach(() => errSpy.mockRestore());

describe('useWeeklyNutritionReport', () => {
  it('shows the empty-state insight before any data loads', () => {
    const hook = renderHook();
    expect(hook.current.canShowInsights).toBe(false);
    expect(hook.current.displayInsights).toEqual([
      { variant: 'neutral', message: 'Log your meals to get personalized insights.' },
    ]);
  });

  it('reload loads the report and derives macro/calorie totals', async () => {
    mockApi.getWeeklyReport.mockResolvedValueOnce(
      reportWith(totals({ calories: 7000, protein: 700 })),
    );
    const hook = renderHook();

    await act(async () => {
      await hook.current.reload();
    });

    expect(hook.current.caloriesSoFar).toBe(7000);
    expect(hook.current.macroNutrients.protein.current).toBe(700);
    expect(hook.current.loading).toBe(false);
    expect(hook.current.canShowInsights).toBe(true);
  });

  it('maps AI insights once data is present', async () => {
    mockApi.getWeeklyReport.mockResolvedValueOnce(
      reportWith(totals({ calories: 5000 })),
    );
    mockApi.getInsights.mockResolvedValueOnce([
      { variant: 'positive', message: 'Nice work' },
    ]);
    const hook = renderHook();

    await act(async () => {
      await hook.current.reload();
    });
    // allow the data-driven insights effect to run
    await act(async () => {});

    expect(hook.current.displayInsights).toEqual([
      { variant: 'positive', message: 'Nice work' },
    ]);
    expect(hook.current.usingFallback).toBe(false);
  });

  it('falls back to rule-based insights when the insights request fails', async () => {
    mockApi.getWeeklyReport.mockResolvedValueOnce(
      reportWith(
        totals({ calories: 5000 }),
        totals({ fiber: 10, sugar: 60, protein: 100 }),
      ),
    );
    mockApi.getInsights.mockRejectedValueOnce(new Error('AI down'));
    const hook = renderHook();

    await act(async () => {
      await hook.current.reload();
    });
    await act(async () => {});

    expect(hook.current.usingFallback).toBe(true);
    expect(hook.current.insightsError).toBeTruthy();
    // rule-based: low fiber + high sugar messages present
    const messages = hook.current.displayInsights.map(i => i.message).join(' | ');
    expect(messages).toMatch(/Fiber low/);
    expect(messages).toMatch(/Sugar high/);
  });
});
