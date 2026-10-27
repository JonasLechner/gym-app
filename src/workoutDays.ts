import type { Workout } from './types';

export function workoutDateError(workout: Workout, workouts: Workout[]): string | null {
  return workouts.some((saved) => saved.date === workout.date && saved.id !== workout.id)
    ? 'Only one workout per day is allowed. Choose a date without a workout.'
    : null;
}

/** Lossless migration/import merge: retain sets and notes, and never finish a draft implicitly. */
export function mergeWorkoutsByDate(workouts: Workout[], newId: () => string): Workout[] {
  const days = new Map<string, Workout>();
  const exerciseIds = new Map<string, Set<string>>();
  const setIds = new Map<string, Set<string>>();

  for (const workout of workouts) {
    let day = days.get(workout.date);
    if (!day) {
      day = { ...workout, exercises: [] };
      days.set(workout.date, day);
      exerciseIds.set(workout.date, new Set());
      setIds.set(workout.date, new Set());
    } else {
      if (workout.draft) day.draft = true;
      if (workout.note && workout.note !== day.note)
        day.note = day.note ? `${day.note}\n\n${workout.note}` : workout.note;
    }

    const usedExercises = exerciseIds.get(workout.date)!;
    const usedSets = setIds.get(workout.date)!;
    for (const exercise of workout.exercises) {
      let entry = day.exercises.find(
        (item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase(),
      );
      if (!entry) {
        entry = {
          ...exercise,
          id: uniqueId(exercise.id, usedExercises, newId),
          sets: [],
        };
        day.exercises.push(entry);
      }
      entry.sets.push(
        ...exercise.sets.map((set) => ({ ...set, id: uniqueId(set.id, usedSets, newId) })),
      );
    }
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function uniqueId(id: string, used: Set<string>, newId: () => string): string {
  let next = id;
  while (used.has(next)) next = newId();
  used.add(next);
  return next;
}
