import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { exportBeforeRestoreBackup } from './backup';
import { readSafetySnapshot } from './backupRestore';
import { useStore } from './store';

export function useBackupRestore() {
  const { data, replaceData } = useStore();
  const exportSafetyCopy = useCallback(async () => {
    const snapshot = await readSafetySnapshot(data, AsyncStorage);
    const filename = await exportBeforeRestoreBackup(snapshot.data);
    return { filename, storedValue: snapshot.storedValue };
  }, [data]);
  return { exportSafetyCopy, restoreBackup: replaceData };
}
