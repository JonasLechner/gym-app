import type { AppData, Workout } from './types';
import { workoutDateError } from './workoutDays';

export function workoutSaveError(workout: Workout, workouts: Workout[] = []): string | null {
  return !workout.draft && !workout.exercises.some((exercise) => exercise.sets.length > 0)
    ? 'A completed workout needs at least one set. Use Delete workout to remove it.'
    : workoutDateError(workout, workouts);
}

export function assertWorkoutCanBeSaved(workout: Workout, workouts: Workout[] = []): void {
  const error = workoutSaveError(workout, workouts);
  if (error) throw new Error(error);
}

/** Merge one workout without replacing unrelated data or mutating the input. */
export function withSavedWorkout(data: AppData, workout: Workout, newId: () => string): AppData {
  assertWorkoutCanBeSaved(workout, data.workouts);
  const workouts = [...data.workouts.filter((saved) => saved.id !== workout.id), workout].sort(
    (a, b) => b.date.localeCompare(a.date),
  );
  const definitions = new Map(
    data.exercises.map((exercise) => [exercise.name.toLowerCase(), exercise]),
  );
  workout.exercises.forEach((exercise) => {
    if (!definitions.has(exercise.name.toLowerCase()))
      definitions.set(exercise.name.toLowerCase(), {
        id: newId(),
        name: exercise.name,
        category: exercise.category,
      });
  });
  return {
    ...data,
    workouts,
    exercises: [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Adopt the persisted web snapshot, retaining categories created in the same UI event. */
export function workoutStoreState(
  data: AppData,
  workout: Workout,
  webSnapshot: AppData | undefined,
  newId: () => string,
): AppData {
  assertWorkoutCanBeSaved(workout, webSnapshot?.workouts ?? data.workouts);
  if (!webSnapshot) return withSavedWorkout(data, workout, newId);
  const categories = data.customCategories.filter(
    (category) =>
      workout.exercises.some((e) => e.category === category.name) &&
      !webSnapshot.customCategories.some((saved) => saved.name === category.name),
  );
  return categories.length
    ? { ...webSnapshot, customCategories: [...webSnapshot.customCategories, ...categories] }
    : webSnapshot;
}
