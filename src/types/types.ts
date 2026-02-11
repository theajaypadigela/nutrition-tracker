export interface FoodLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BottomNavigationProps {
  activeTab: 'home' | 'habits' | 'food' | 'reports';
  onTabChange: (tab: 'home' | 'habits' | 'food' | 'reports') => void;
}

export interface Habit {
    id: string;
    name: string;
    completed: boolean;
    time?: String; // e.g., "08:00 AM"
    repeatedDays?: string; // e.g., "Mon, Wed, Fri"
}
