import { useCallback } from 'react';
import { exportBackup } from './backup';
import { useStore } from './store';
import type { AppData, Workout } from './types';

export type WorkoutSaveResult = {
  backupSlot?: 'A' | 'B';
  backupError?: unknown;
};

/**
 * Application-level save operation. UI components decide how to present the result;
 * this boundary owns workout persistence and rotating-backup coordination.
 */
export function useWorkoutPersistence() {
  const { data, saveWorkout, updateSettings } = useStore();

  return useCallback(
    async (workout: Workout, webSnapshot?: AppData): Promise<WorkoutSaveResult> => {
      saveWorkout(workout, webSnapshot);
      const current = webSnapshot ?? data;
      if (!current.settings.backupAfterWorkout) return {};

      const backupSlot = current.settings.nextBackupSlot;
      const backedUpAt = new Date().toISOString();
      const settings = {
        ...current.settings,
        nextBackupSlot: backupSlot === 'A' ? ('B' as const) : ('A' as const),
        lastBackupAt: backedUpAt,
      };
      const backupData = {
        ...current,
        workouts: [...current.workouts.filter((saved) => saved.id !== workout.id), workout].sort(
          (a, b) => b.date.localeCompare(a.date),
        ),
        settings,
      };

      try {
        await exportBackup(backupData, backupSlot);
        updateSettings(settings);
        return { backupSlot };
      } catch (backupError) {
        return { backupSlot, backupError };
      }
    },
    [data, saveWorkout, updateSettings],
  );
}
