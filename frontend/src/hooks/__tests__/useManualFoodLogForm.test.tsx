import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useManualFoodLogForm } from '../useManualFoodLogForm';
import { foodLogApi } from '@/services/api/foodLogApi';

jest.mock('@/services/api/foodLogApi', () => ({
  foodLogApi: { addEntries: jest.fn() },
}));

const mockApi = foodLogApi as jest.Mocked<typeof foodLogApi>;

function renderForm(date = '2026-06-14') {
  const ref: { current: ReturnType<typeof useManualFoodLogForm> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useManualFoodLogForm(date);
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
  jest.useFakeTimers();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  errSpy.mockRestore();
});

describe('useManualFoodLogForm', () => {
  it('blocks submit and surfaces field errors when empty', async () => {
    const hook = renderForm();
    await act(async () => {
      await hook.current.handleSubmit();
    });
    expect(mockApi.addEntries).not.toHaveBeenCalled();
    expect(hook.current.errors.mealType).toBe('Please select a meal type');
    expect(hook.current.errors.foodName).toBe('Food name is required');
    expect(hook.current.errors.quantity).toBe('Quantity is required');
    expect(hook.current.errors.unit).toBe('Unit is required');
  });

  it('rejects a non-positive quantity', async () => {
    const hook = renderForm();
    act(() => {
      hook.current.setMealType('breakfast');
      hook.current.setFoodName('Egg');
      hook.current.setQuantity('0');
      hook.current.setUnit('g');
    });
    await act(async () => {
      await hook.current.handleSubmit();
    });
    expect(mockApi.addEntries).not.toHaveBeenCalled();
    expect(hook.current.errors.quantity).toBe(
      'Quantity must be a positive number',
    );
  });

  it('submits a trimmed entry with parsed quantity, then shows success and resets', async () => {
    mockApi.addEntries.mockResolvedValueOnce({});
    const hook = renderForm();
    act(() => {
      hook.current.setMealType('lunch');
      hook.current.setFoodName('  Rice  ');
      hook.current.setQuantity('150');
      hook.current.setUnit(' g ');
    });

    await act(async () => {
      await hook.current.handleSubmit();
    });

    expect(mockApi.addEntries).toHaveBeenCalledWith('2026-06-14', 'lunch', [
      { name: 'Rice', quantity: 150, unit: 'g' },
    ]);
    expect(hook.current.isSuccess).toBe(true);
    expect(hook.current.foodName).toBe('');
    expect(hook.current.mealType).toBe('');

    // success banner auto-dismisses after 3s
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(hook.current.isSuccess).toBe(false);
  });

  it('surfaces a submit error when the request fails', async () => {
    mockApi.addEntries.mockRejectedValueOnce(new Error('network'));
    const hook = renderForm();
    act(() => {
      hook.current.setMealType('dinner');
      hook.current.setFoodName('Soup');
      hook.current.setQuantity('1');
      hook.current.setUnit('bowl');
    });

    await act(async () => {
      await hook.current.handleSubmit();
    });

    expect(hook.current.submitError).toBe(
      'Failed to log food entry. Please try again.',
    );
    expect(hook.current.submitting).toBe(false);
  });

  it('clearError clears a single field', () => {
    const hook = renderForm();
    act(() => {
      hook.current.handleSubmit();
    });
    act(() => {
      hook.current.clearError('foodName');
    });
    expect(hook.current.errors.foodName).toBe('');
  });
});
