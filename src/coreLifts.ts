export const CORE_LIFTS = [
  { id: 'squat', label: 'Squat', exerciseName: 'Barbell Squat' },
  { id: 'bench', label: 'Bench', exerciseName: 'Flat Barbell Bench Press' },
  { id: 'deadlift', label: 'Deadlift', exerciseName: 'Deadlift' },
] as const;

export type CoreLiftId = (typeof CORE_LIFTS)[number]['id'];
