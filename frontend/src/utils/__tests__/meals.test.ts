import {
  CANONICAL_MEAL_ORDER,
  createEmptyMeals,
  normalizeMealType,
  normalizeMeals,
} from '../meals';
import { Meals } from '@/types/types';

describe('normalizeMealType', () => {
  it('returns null for empty / nullish input', () => {
    expect(normalizeMealType(undefined)).toBeNull();
    expect(normalizeMealType(null)).toBeNull();
    expect(normalizeMealType('')).toBeNull();
  });

  it('maps exact aliases (case / spacing / separators insensitive)', () => {
    expect(normalizeMealType('Breakfast')).toBe('breakfast');
    expect(normalizeMealType('  break_fast ')).toBe('breakfast');
    expect(normalizeMealType('SNACKS')).toBe('snack');
    expect(normalizeMealType('supper')).toBe('dinner');
  });

  it('falls back to substring matching for noisy values', () => {
    expect(normalizeMealType('late lunch today')).toBe('lunch');
    expect(normalizeMealType('evening dinner plate')).toBe('dinner');
  });

  it('returns null for unrecognized values', () => {
    expect(normalizeMealType('brunch-ish')).toBeNull();
  });
});

describe('createEmptyMeals', () => {
  it('returns all canonical slots as empty arrays', () => {
    const empty = createEmptyMeals();
    expect(Object.keys(empty).sort()).toEqual([...CANONICAL_MEAL_ORDER].sort());
    CANONICAL_MEAL_ORDER.forEach(slot => expect(empty[slot]).toEqual([]));
  });
});

describe('normalizeMeals', () => {
  it('returns empty meals for null / undefined', () => {
    expect(normalizeMeals(null)).toEqual(createEmptyMeals());
    expect(normalizeMeals(undefined)).toEqual(createEmptyMeals());
  });

  it('routes unknown meal types into the snack slot', () => {
    const input = { mystery: [{ id: '1' }] } as unknown as Meals;
    const result = normalizeMeals(input);
    expect(result.snack).toHaveLength(1);
    expect(result.breakfast).toEqual([]);
  });

  it('concatenates items that resolve to the same canonical slot', () => {
    const input = {
      breakfast: [{ id: 'a' }],
      'break fast': [{ id: 'b' }],
    } as unknown as Meals;
    const result = normalizeMeals(input);
    expect(result.breakfast.map((f: any) => f.id)).toEqual(['a', 'b']);
  });

  it('tolerates non-array values without throwing', () => {
    const input = { lunch: null } as unknown as Meals;
    expect(() => normalizeMeals(input)).not.toThrow();
    expect(normalizeMeals(input).lunch).toEqual([]);
  });
});
