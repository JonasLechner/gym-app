import type { CustomCategory } from './types';

export const BUILT_IN_CATEGORIES = [
  { name: 'Chest', color: '#ff5a65' },
  { name: 'Back', color: '#2f8cff' },
  { name: 'Legs', color: '#42d392' },
  { name: 'Calves', color: '#7ed957' },
  { name: 'Shoulders', color: '#f4b942' },
  { name: 'Biceps', color: '#b779ff' },
  { name: 'Triceps', color: '#ff8a4c' },
  { name: 'Abs', color: '#31d5c8' },
  { name: 'Forearms', color: '#c08b5c' },
  { name: 'Cardio', color: '#ff69b4' },
] as const;

export const CATEGORY_COLORS = ['#5ac8fa','#af8cff','#ffcc4d','#64d98b','#ff7582','#ef7cff','#8d9cff','#e6a15c'];

const calves = new Set(['Standing Calf Raise 1','Standing Calf Raise Machine','Leg Press Calfs','Leg Press Calfs 1','Leg Press Calfs Liegend']);
const forearms = new Set(['Forarm Curl Dumbell Unilat','Forearm Barbell','Straightbar Cable Wristcurl']);

export function canonicalExercise(name: string, category: string) {
  const cleanName = name.trim();
  if (cleanName.toLowerCase() === 'face pull' || cleanName.toLowerCase() === 'cable face pull') return { name: 'Cable Face Pull', category: 'Shoulders' };
  if (calves.has(cleanName)) return { name: cleanName, category: 'Calves' };
  if (forearms.has(cleanName) || category.trim().toLowerCase() === 'forearm') return { name: cleanName, category: 'Forearms' };
  return { name: cleanName, category: category.trim() || 'Uncategorised' };
}

export function colorForCategory(name: string, custom: CustomCategory[] = []) {
  return BUILT_IN_CATEGORIES.find(c => c.name.toLowerCase() === name.toLowerCase())?.color
    ?? custom.find(c => c.name.toLowerCase() === name.toLowerCase())?.color
    ?? '#9299a7';
}
