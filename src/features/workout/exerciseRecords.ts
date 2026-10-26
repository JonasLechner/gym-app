import type { SetEntry, Workout } from '../../types';

export type SetRecord = { weight: boolean; reps: boolean };

// Evaluate current sets in order, against completed workouts before the selected date.
export function exerciseSetRecords(
  workouts: Workout[],
  exerciseName: string,
  date: string,
  sets: SetEntry[],
): Map<string, SetRecord> {
  let highestWeight = -Infinity;
  const repsByWeight = new Map<number, number>();
  const records = new Map<string, SetRecord>();
  const valid = (set: SetEntry) =>
    Number.isFinite(set.weight) && set.weight >= 0 && Number.isFinite(set.reps) && set.reps > 0;
  const remember = (set: SetEntry) => {
    highestWeight = Math.max(highestWeight, set.weight);
    repsByWeight.set(set.weight, Math.max(repsByWeight.get(set.weight) ?? 0, set.reps));
  };

  for (const workout of workouts) {
    if (workout.draft || workout.date >= date) continue;
    for (const exercise of workout.exercises) {
      if (exercise.name !== exerciseName) continue;
      for (const set of exercise.sets) {
        if (valid(set)) remember(set);
      }
    }
  }

  for (const set of sets) {
    if (!valid(set)) continue;
    const record = {
      weight: set.weight > highestWeight,
      reps: set.reps > (repsByWeight.get(set.weight) ?? 0),
    };
    if (record.weight || record.reps) records.set(set.id, record);
    remember(set);
  }
  return records;
}
