import type { Workout } from './types';

export function filterWorkoutsByCategories(workouts: Workout[], categories: string[]): Workout[] {
  if (!categories.length) return workouts;
  return workouts.filter((workout) =>
    workout.exercises.some((exercise) => categories.includes(exercise.category)),
  );
}

export function workoutCategoriesByDate(workouts: Workout[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  workouts.forEach((workout) => {
    const categories = result.get(workout.date) ?? [];
    workout.exercises.forEach((exercise) => {
      if (!categories.includes(exercise.category)) categories.push(exercise.category);
    });
    result.set(workout.date, categories);
  });
  return result;
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function calculateHistoryMetrics(
  allWorkouts: Workout[],
  filteredWorkouts: Workout[],
  selectedCategories: string[],
  currentDate: string,
) {
  const categoryMatches = (category: string) =>
    !selectedCategories.length || selectedCategories.includes(category);
  const filteredVolume = filteredWorkouts.reduce(
    (total, workout) =>
      total +
      workout.exercises
        .filter((exercise) => categoryMatches(exercise.category))
        .reduce(
          (exerciseTotal, exercise) =>
            exerciseTotal +
            exercise.sets.reduce((setTotal, set) => setTotal + set.weight * set.reps, 0),
          0,
        ),
    0,
  );
  const thirtyDaysAgo = new Date(`${currentDate}T00:00:00`);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const threshold = localDateKey(thirtyDaysAgo);
  const recentCount = filteredWorkouts.filter(
    (workout) => workout.date >= threshold && workout.date <= currentDate,
  ).length;
  const dates = filteredWorkouts.map((workout) => workout.date).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const spanWeeks =
    firstDate && lastDate
      ? Math.max(
          1,
          ((new Date(`${lastDate}T00:00:00`).getTime() -
            new Date(`${firstDate}T00:00:00`).getTime()) /
            86400000 +
            1) /
            7,
        )
      : 1;
  return {
    workoutCount: filteredWorkouts.length,
    filteredVolume,
    recentCount,
    averagePerWeek: filteredWorkouts.length / spanWeeks,
    matchPercentage: allWorkouts.length ? (filteredWorkouts.length / allWorkouts.length) * 100 : 0,
    lastDate,
  };
}
