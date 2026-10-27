import { createSetRecordTracker, type SetRecord } from '../../setRecords';
import type { Workout } from '../../types';

export type RecordAchievement = {
  key: string;
  date: string;
  weight: number;
  reps: number;
  record: SetRecord;
};

export type PersonalRecords = {
  heaviest: RecordAchievement | null;
  repRecords: RecordAchievement[];
  timeline: RecordAchievement[];
  sessions: number;
  sets: number;
};

/** Exact exercise-name matching (ignoring case/outer whitespace), never variant pooling. */
export function personalRecords(workouts: Workout[], exerciseName: string): PersonalRecords {
  const tracker = createSetRecordTracker();
  const name = exerciseName.trim().toLowerCase();
  const byWeight = new Map<number, RecordAchievement>();
  const timeline: RecordAchievement[] = [];
  let sessions = 0;
  let sets = 0;

  const completed = workouts
    .filter((workout) => !workout.draft)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const workout of completed) {
    let hasSets = false;
    for (const exercise of workout.exercises) {
      if (exercise.name.trim().toLowerCase() !== name) continue;
      for (const set of exercise.sets) {
        const record = tracker.observe(set);
        if (!record) continue;
        hasSets = true;
        sets++;
        const achievement: RecordAchievement = {
          key: `${workout.id}:${exercise.id}:${set.id}`,
          date: workout.date,
          weight: set.weight,
          reps: set.reps,
          record,
        };
        if (record.reps) byWeight.set(set.weight, achievement);
        if (record.weight || record.reps) timeline.push(achievement);
      }
    }
    if (hasSets) sessions++;
  }

  const repRecords = [...byWeight.values()].sort((a, b) => b.weight - a.weight);
  return {
    heaviest: repRecords[0] ?? null,
    repRecords,
    timeline: timeline.reverse(),
    sessions,
    sets,
  };
}
