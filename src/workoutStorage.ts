import { newId } from './ids';
import type { AppData, Workout } from './types';
import { withSavedWorkout } from './workoutState';

// AsyncStorage's web backend uses this same key.
export const DATA_STORAGE_KEY = '@liftnotes/data/v1';
type WorkoutStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Synchronously persist pending edits before page hide. Read the latest stored
 * state first so an inactive tab cannot replace unrelated changes. Parsing,
 * read, and write failures intentionally propagate; never fall back to stale data.
 */
export function persistWorkoutOnWeb(
  data: AppData,
  workout: Workout,
  storage: WorkoutStorage = window.localStorage,
): AppData {
  const stored = storage.getItem(DATA_STORAGE_KEY);
  const latest: AppData = stored === null ? data : JSON.parse(stored);
  const merged = withSavedWorkout(latest, workout, newId);
  storage.setItem(DATA_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}
