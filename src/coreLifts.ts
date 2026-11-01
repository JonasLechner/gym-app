import { exerciseLookup, exerciseNameKey } from './exercises';
import type { ExerciseDefinition } from './types';

export const CORE_LIFTS = [
  { id: 'squat', label: 'Squat', exerciseName: 'Barbell Squat' },
  { id: 'bench', label: 'Bench', exerciseName: 'Flat Barbell Bench Press' },
  { id: 'deadlift', label: 'Deadlift', exerciseName: 'Deadlift' },
] as const;

export type CoreLiftId = (typeof CORE_LIFTS)[number]['id'];

/** A renamed core lift retains its original role without including any other variants. */
export function coreLiftsForExercises(exercises: ExerciseDefinition[]) {
  const lookup = exerciseLookup(exercises);
  return CORE_LIFTS.map((lift) => ({
    ...lift,
    exerciseName: lookup.get(exerciseNameKey(lift.exerciseName))?.name ?? lift.exerciseName,
  }));
}
