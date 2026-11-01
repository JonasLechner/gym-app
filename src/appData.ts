import { canonicalExercise } from './categories';
import { exerciseFields, exerciseLookup, exerciseNameKey } from './exercises';
import type { AppData, ExerciseDefinition, ExerciseEntry } from './types';
import { mergeWorkoutsByDate } from './workoutDays';

const EXERCISE_DEFAULTS_VERSION = 1;
const DEFAULT_EXERCISES: [string, string][] = [
  ['Barbell Squat', 'Legs'],
  ['Behind Back Cable Lat Raise 2 Arms', 'Shoulders'],
  ['Cable Crunch', 'Abs'],
  ['Cable Curl', 'Biceps'],
  ['Cable Curl Unilateral', 'Biceps'],
  ['Cable Face Pull', 'Shoulders'],
  ['Cable Fly', 'Chest'],
  ['Cable Overhead Triceps Extension', 'Triceps'],
  ['Deadlift', 'Back'],
  ['Dumbbell Hammer Curl', 'Biceps'],
  ['Dumbbell Preacher Curl', 'Biceps'],
  ['Dumbell Preacher Hammer Curl', 'Biceps'],
  ['EZ-Bar Preacher Curl', 'Biceps'],
  ['Flat Barbell Bench Press', 'Chest'],
  ['Flat Bench Pause Reps', 'Chest'],
  ['Flat Dumbbell Bench Press', 'Chest'],
  ['Hanging Leg Raise', 'Abs'],
  ['High Row Unilat', 'Back'],
  ['Hyper Extension', 'Back'],
  ['Incline Barbell Bench Press', 'Chest'],
  ['Incline Dumbbell Bench Press', 'Chest'],
  ['Lat Pulldown', 'Back'],
  ['Lat Pulldown Close Grip', 'Back'],
  ['Lat Pulldown Machine', 'Back'],
  ['Lateral Dumbbell Raise', 'Shoulders'],
  ['Lateral Machine Raise', 'Shoulders'],
  ['Leg Curl Machine', 'Legs'],
  ['Leg Extension Machine', 'Legs'],
  ['Leg Press', 'Legs'],
  ['Low Row', 'Back'],
  ['Lying Leg Curl Machine', 'Legs'],
  ['Machine Dip', 'Triceps'],
  ['Machine Squat', 'Legs'],
  ['Preacher Hammer Curl', 'Biceps'],
  ['Pull Up', 'Back'],
  ['Pullover', 'Back'],
  ['Pullover Machine', 'Back'],
  ['Reverse Fly Unilateral', 'Shoulders'],
  ['Reverse Lat Pulldown', 'Back'],
  ['Romanian Deadlift', 'Legs'],
  ['Rope Push Down', 'Triceps'],
  ['Seated Cable Row', 'Back'],
  ['Seated Cable Row Unilateral', 'Back'],
  ['Seated Dumbbell Lateral Raise', 'Shoulders'],
  ['Seated Dumbbell Press', 'Shoulders'],
  ['Seated Dumbell Curl', 'Biceps'],
  ['Seated Hammer Curl', 'Biceps'],
  ['Seated Incline Dumbbell Curl', 'Biceps'],
  ['Seated Machine Curl', 'Biceps'],
  ['Seated Machine Fly', 'Chest'],
  ['Seated Row Machine', 'Back'],
  ['Seated Shoulder Press', 'Shoulders'],
  ['Seated Smith Machine Press', 'Shoulders'],
  ['Standing Calf Raise Machine', 'Calves'],
  ['T-Bar Row', 'Back'],
  ['Triceps Kickbacks', 'Triceps'],
  ['Unilateral Triceps Extension', 'Triceps'],
];
const DEFAULT_SETTINGS: AppData['settings'] = {
  restSeconds: 120,
  timerEnabled: true,
  backupAfterWorkout: true,
  exerciseDefaultsVersion: EXERCISE_DEFAULTS_VERSION,
};

export function createInitialData(newId: () => string): AppData {
  return {
    workouts: [],
    exercises: DEFAULT_EXERCISES.map(([name, category]) => ({ id: newId(), name, category })),
    routines: [],
    customCategories: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Framework-free load/restore migration; explicit exercise edits survive every reload. */
export function normalizeAppData(raw: Partial<AppData>, newId: () => string): AppData {
  const definitions = new Map<string, ExerciseDefinition>();
  const explicit = exerciseLookup((raw.exercises ?? []).filter((exercise) => exercise.customized));
  if ((raw.settings?.exerciseDefaultsVersion ?? 0) < EXERCISE_DEFAULTS_VERSION) {
    for (const [name, category] of DEFAULT_EXERCISES) {
      if (!explicit.has(exerciseNameKey(name)))
        definitions.set(exerciseNameKey(name), { id: newId(), name, category });
    }
  }
  for (const exercise of raw.exercises ?? []) {
    const fixed = exercise.customized
      ? { name: exercise.name.trim(), category: exercise.category.trim() }
      : canonicalExercise(exercise.name, exercise.category);
    if (!exercise.customized && explicit.has(exerciseNameKey(fixed.name))) continue;
    definitions.set(exerciseNameKey(fixed.name), { ...exercise, ...fixed });
  }
  const lookup = exerciseLookup([...definitions.values()]);
  const workouts = mergeWorkoutsByDate(
    (raw.workouts ?? []).map((workout) => {
      const merged = new Map<string, ExerciseEntry>();
      for (const exercise of workout.exercises) {
        const fixed = exerciseFields(exercise.name, exercise.category, lookup);
        const key = exerciseNameKey(fixed.name);
        const found = merged.get(key);
        if (found) found.sets.push(...exercise.sets);
        else merged.set(key, { ...exercise, ...fixed, sets: [...exercise.sets] });
      }
      return { ...workout, exercises: [...merged.values()] };
    }),
    newId,
  );
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (!definitions.has(exerciseNameKey(exercise.name)))
        definitions.set(exerciseNameKey(exercise.name), {
          id: newId(),
          name: exercise.name,
          category: exercise.category,
        });
    }
  }
  const settings = {
    ...DEFAULT_SETTINGS,
    ...raw.settings,
    exerciseDefaultsVersion: EXERCISE_DEFAULTS_VERSION,
  };
  // Older installations still contain the retired rotation setting.
  delete (settings as AppData['settings'] & { nextBackupSlot?: unknown }).nextBackupSlot;
  return {
    ...raw,
    workouts,
    exercises: [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    routines: raw.routines ?? [],
    customCategories: raw.customCategories ?? [],
    settings,
  };
}
