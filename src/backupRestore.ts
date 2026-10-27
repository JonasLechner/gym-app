import { validateBackup } from './backupValidation';
import type { AppData } from './types';
import { DATA_STORAGE_KEY } from './workoutStorage';

export type BackupStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type SafetySnapshot = { data: AppData; storedValue: string | null };

/** Read the latest persisted data, not a possibly stale UI snapshot. */
export async function readSafetySnapshot(
  fallback: AppData,
  storage: BackupStorage,
): Promise<SafetySnapshot> {
  const storedValue = await storage.getItem(DATA_STORAGE_KEY);
  const data = validateBackup(storedValue === null ? fallback : JSON.parse(storedValue));
  return { data, storedValue };
}

/** Return only after a validated replacement is durable. Callers must not commit UI state sooner. */
export async function writeRestoredBackup(
  input: unknown,
  expectedStoredValue: string | null,
  storage: BackupStorage,
  normalize: (data: AppData) => AppData,
): Promise<AppData> {
  const next = validateBackup(normalize(validateBackup(input)));
  const current = await storage.getItem(DATA_STORAGE_KEY);
  if (current !== expectedStoredValue)
    throw new Error(
      'Local data changed since your safety copy was exported. Export and save a fresh copy before restoring.',
    );
  await storage.setItem(DATA_STORAGE_KEY, JSON.stringify(next));
  return next;
}
