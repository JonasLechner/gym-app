import { useCallback } from 'react';
import { exportBackup } from './backup';
import { workoutBackupData } from './backupData';
import { newId } from './ids';
import { useStore } from './store';
import type { AppData, Workout } from './types';

export type WorkoutSaveResult = {
  backupFilename?: string;
  backupError?: unknown;
};

/**
 * Application-level save operation. UI components decide how to present the result;
 * this boundary owns workout persistence and automatic-backup coordination.
 */
export function useWorkoutPersistence() {
  const { data, saveWorkout, updateSettings } = useStore();

  return useCallback(
    async (workout: Workout, webSnapshot?: AppData): Promise<WorkoutSaveResult> => {
      saveWorkout(workout, webSnapshot);
      const current = webSnapshot ?? data;
      if (!current.settings.backupAfterWorkout) return {};

      const backedUpAt = new Date().toISOString();
      const backupData = workoutBackupData(current, workout, backedUpAt, newId);

      try {
        const backupFilename = await exportBackup(backupData);
        updateSettings({ lastBackupAt: backedUpAt });
        return { backupFilename };
      } catch (backupError) {
        return { backupError };
      }
    },
    [data, saveWorkout, updateSettings],
  );
}
