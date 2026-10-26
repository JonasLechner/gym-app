import type { ExerciseEntry, Workout } from '../../types';

export function moveExercise<T extends { id: string }>(
  exercises: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const from = exercises.findIndex((exercise) => exercise.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= exercises.length) return exercises;
  const next = [...exercises];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

export function completedCopySources(workouts: Workout[], targetDate: string): Workout[] {
  return workouts.filter((w) => !w.draft && w.date < targetDate);
}

export function previousCompletedWorkout(
  workouts: Workout[],
  name: string,
  date: string,
): Workout | undefined {
  return workouts
    .filter((w) => !w.draft && w.date < date && w.exercises.some((e) => e.name === name))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function removesLastSetFromCompletedWorkout(
  existing: Workout | undefined,
  current: ExerciseEntry[],
  next: ExerciseEntry[],
): boolean {
  return (
    !!existing &&
    !existing.draft &&
    current.some((e) => e.sets.length > 0) &&
    !next.some((e) => e.sets.length > 0)
  );
}
