import type { SetEntry, Workout } from './types';

export type ProgressPoint = {
  date: string;
  value: number;
  weight: number;
  reps: number;
};

export type ValuePoint = { date: string; value: number };

export const REP_RANGES = [
  { label: '1', min: 1, max: 1 },
  { label: '2–3', min: 2, max: 3 },
  { label: '4–5', min: 4, max: 5 },
  { label: '6–8', min: 6, max: 8 },
  { label: '9–12', min: 9, max: 12 },
  { label: '13–20', min: 13, max: 20 },
] as const;

// Strength Level repetition percentages. Results above 30 reps are intentionally unsupported.
const REP_PERCENTAGES = [
  0, 100, 97, 94, 92, 89, 86, 83, 81, 78, 75, 73, 71, 70, 68, 67, 65, 64, 63, 61, 60, 59, 58, 57,
  56, 55, 54, 53, 52, 51, 50,
] as const;

export function projectedOneRepMax(weight: number, reps: number): number | null {
  if (reps < 1 || reps > 30) return null;
  return weight / (REP_PERCENTAGES[reps]! / 100);
}

export function exerciseProgress(workouts: Workout[], exerciseName: string) {
  const sessions = workouts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((workout) => {
      const sets =
        workout.exercises
          .find((exercise) => exercise.name === exerciseName)
          ?.sets.filter((set) => set.reps >= 1) ?? [];
      if (!sets.length) return [];
      const maxSet = sets.reduce((best, set) => (set.weight > best.weight ? set : best));
      const projectedSet = sets
        .map((set) => ({ set, value: projectedOneRepMax(set.weight, set.reps) }))
        .filter((result): result is { set: SetEntry; value: number } => result.value !== null)
        .sort((a, b) => b.value - a.value)[0];
      return [{ date: workout.date, maxSet, projectedSet }];
    });

  let record = -Infinity;
  const weightRecords: ProgressPoint[] = [];
  sessions.forEach(({ date, maxSet }) => {
    if (maxSet.weight <= record) return;
    record = maxSet.weight;
    weightRecords.push({ date, value: maxSet.weight, weight: maxSet.weight, reps: maxSet.reps });
  });
  const projectedPoints: ProgressPoint[] = sessions.flatMap(({ date, projectedSet }) =>
    projectedSet
      ? [
          {
            date,
            value: projectedSet.value,
            weight: projectedSet.set.weight,
            reps: projectedSet.set.reps,
          },
        ]
      : [],
  );
  return { weightRecords, projectedPoints };
}

export function bestSetsByRepRange(workouts: Workout[], exerciseName: string) {
  const sets = workouts.flatMap((workout) =>
    workout.exercises
      .filter((exercise) => exercise.name === exerciseName)
      .flatMap((exercise) => exercise.sets.filter((set) => set.reps >= 1)),
  );
  return REP_RANGES.map((range) => ({
    label: range.label,
    set: sets
      .filter((set) => set.reps >= range.min && set.reps <= range.max)
      .sort((a, b) => b.weight - a.weight)[0],
  }));
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function weeklyTotalVolume(workouts: Workout[]): ValuePoint[] {
  const weekly = new Map<string, number>();
  workouts.forEach((workout) => {
    const date = new Date(`${workout.date}T00:00:00`);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const key = localDateKey(date);
    const value = workout.exercises.reduce(
      (total, exercise) =>
        total +
        exercise.sets
          .filter((set) => set.reps >= 1)
          .reduce((sum, set) => sum + set.weight * set.reps, 0),
      0,
    );
    weekly.set(key, (weekly.get(key) ?? 0) + value);
  });
  return [...weekly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: value / 1000 }));
}

export function rollingAverage(points: ValuePoint[], windowSize: number): ValuePoint[] {
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - windowSize + 1), index + 1);
    return {
      date: point.date,
      value: window.reduce((sum, item) => sum + item.value, 0) / window.length,
    };
  });
}
