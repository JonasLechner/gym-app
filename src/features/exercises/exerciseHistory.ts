import type { SetEntry, Workout } from '../../types';

export type HistoricalSet = {
  key: string;
  set: SetEntry;
  draft: boolean;
};

export type ExerciseHistoryDay = {
  date: string;
  sets: HistoricalSet[];
};

export function exerciseHistory(workouts: Workout[], exerciseName: string): ExerciseHistoryDay[] {
  const days = new Map<string, HistoricalSet[]>();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (exercise.name !== exerciseName || !exercise.sets.length) continue;

      const sets = days.get(workout.date) ?? [];
      exercise.sets.forEach((set) => {
        sets.push({
          key: `${workout.id}:${exercise.id}:${set.id}`,
          set,
          draft: !!workout.draft,
        });
      });
      days.set(workout.date, sets);
    }
  }

  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, sets]) => ({ date, sets }));
}
