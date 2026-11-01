import { withEditedExercise, type ExerciseChanges } from './exercises';
import type { AppData, ExerciseDefinition } from './types';
import { DATA_STORAGE_KEY } from './workoutStorage';

type ExerciseStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

/** Apply edits to the latest saved data and acknowledge them only after a successful write. */
export async function writeEditedExercise(
  fallback: AppData,
  original: ExerciseDefinition,
  changes: ExerciseChanges,
  storage: ExerciseStorage,
): Promise<AppData> {
  const stored = await storage.getItem(DATA_STORAGE_KEY);
  const latest: AppData = stored === null ? fallback : JSON.parse(stored);
  const current = latest.exercises.find((exercise) => exercise.id === original.id);
  if (current && (current.name !== original.name || current.category !== original.category))
    throw new Error(
      'This exercise changed in another window. Reload the app before editing it again.',
    );
  const next = withEditedExercise(latest, original.id, changes);
  if (next === latest) return next;
  const currentValue = await storage.getItem(DATA_STORAGE_KEY);
  if (currentValue !== stored)
    throw new Error('Local data changed while saving this exercise. Please save again.');
  await storage.setItem(DATA_STORAGE_KEY, JSON.stringify(next));
  return next;
}
