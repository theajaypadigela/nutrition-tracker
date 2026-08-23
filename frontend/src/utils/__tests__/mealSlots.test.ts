import { buildMealSlotStatus, MEAL_SLOTS } from '../mealSlots';
import { createEmptyMeals } from '../meals';
import { Meals } from '@/types/types';

describe('buildMealSlotStatus', () => {
  it('returns all four slots in canonical order, all unlogged when empty', () => {
    const status = buildMealSlotStatus(createEmptyMeals());
    expect(status.map(s => s.key)).toEqual([
      'breakfast',
      'lunch',
      'snack',
      'dinner',
    ]);
    expect(status.every(s => !s.logged && s.count === 0)).toBe(true);
  });

  it('marks slots with entries as logged and counts them', () => {
    const meals = {
      ...createEmptyMeals(),
      breakfast: [{ id: '1' }, { id: '2' }],
      dinner: [{ id: '3' }],
    } as unknown as Meals;

    const status = buildMealSlotStatus(meals);
    const byKey = Object.fromEntries(status.map(s => [s.key, s]));
    expect(byKey.breakfast).toMatchObject({ logged: true, count: 2 });
    expect(byKey.dinner).toMatchObject({ logged: true, count: 1 });
    expect(byKey.lunch).toMatchObject({ logged: false, count: 0 });
  });

  it('carries the display label from MEAL_SLOTS', () => {
    const labels = buildMealSlotStatus(createEmptyMeals()).map(s => s.label);
    expect(labels).toEqual(MEAL_SLOTS.map(s => s.label));
  });
});
