import { createSetRecordTracker, type SetRecord } from '../../setRecords';
import type { SetEntry, Workout } from '../../types';

export type { SetRecord } from '../../setRecords';

// Evaluate current sets in order, against completed workouts before the selected date.
export function exerciseSetRecords(
  workouts: Workout[],
  exerciseName: string,
  date: string,
  sets: SetEntry[],
): Map<string, SetRecord> {
  const tracker = createSetRecordTracker();
  const records = new Map<string, SetRecord>();
  for (const workout of workouts) {
    if (workout.draft || workout.date >= date) continue;
    for (const exercise of workout.exercises) {
      if (exercise.name !== exerciseName) continue;
      for (const set of exercise.sets) tracker.observe(set);
    }
  }
  for (const set of sets) {
    const record = tracker.observe(set);
    if (record && (record.weight || record.reps)) records.set(set.id, record);
  }
  return records;
}
