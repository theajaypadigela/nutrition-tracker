import { calculateFoodMacros } from '../foodCalculations';
import { FoodItem } from '../../types/types';

const food = (over: Partial<FoodItem>): FoodItem => ({
  id: 'f',
  name: 'Food',
  quantity: '1',
  servingSize: '1 serving',
  ...over,
});

describe('calculateFoodMacros', () => {
  it('returns zeros for an empty list', () => {
    expect(calculateFoodMacros([])).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it('sums macros and treats missing values as 0', () => {
    expect(
      calculateFoodMacros([
        food({ calories: 100, protein: 10, carbs: 20, fat: 5 }),
        food({ calories: 50, protein: 5 }), // carbs/fat missing
      ]),
    ).toEqual({ calories: 150, protein: 15, carbs: 20, fat: 5 });
  });
});
