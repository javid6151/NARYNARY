import { Moon, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import { addDays } from '../../lib/format';
import type { MealType } from './types';

/** The three daily meals with their default serving window (HH:MM). */
export const MEALS: { id: MealType; label: string; icon: LucideIcon; start: string; end: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: Sunrise, start: '07:00', end: '09:00' },
  { id: 'lunch', label: 'Lunch', icon: Sun, start: '12:00', end: '14:00' },
  { id: 'dinner', label: 'Dinner', icon: Moon, start: '19:00', end: '21:00' },
];

/** Monday of the week containing `d` (YYYY-MM-DD). */
export const monday = (d: string) => {
  const x = new Date(d + 'T00:00:00');
  const off = (x.getDay() + 6) % 7;
  return addDays(d, -off);
};
