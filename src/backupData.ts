import type { AppData, Workout } from './types';
import { withSavedWorkout } from './workoutState';

export const BACKUP_FILENAME = 'LiftNotes-backup.json';

/** Include the finished workout and its definitions without altering the live data. */
export function workoutBackupData(
  data: AppData,
  workout: Workout,
  backedUpAt: string,
  newId: () => string,
): AppData {
  const saved = withSavedWorkout(data, workout, newId);
  return {
    ...saved,
    settings: { ...saved.settings, lastBackupAt: backedUpAt },
  };
}
