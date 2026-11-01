import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AppData } from './types';
import { BACKUP_FILENAME } from './backupData';

export async function exportBackup(data: AppData): Promise<string> {
  await exportBackupFile(data, BACKUP_FILENAME);
  return BACKUP_FILENAME;
}

/** Distinct from the edited import file and regular backup. */
export async function exportBeforeRestoreBackup(data: AppData): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `LiftNotes-before-restore-${timestamp}.json`;
  await exportBackupFile(data, filename);
  return filename;
}

async function exportBackupFile(data: AppData, filename: string) {
  const json = JSON.stringify(data);

  if (Platform.OS === 'web') {
    const browser = globalThis as any;
    const blob = new browser.Blob([json], { type: 'application/json' });
    const url = browser.URL.createObjectURL(blob);
    const link = browser.document.createElement('a');
    link.href = url;
    link.download = filename;
    try {
      browser.document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      setTimeout(() => browser.URL.revokeObjectURL(url), 1000);
    }
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export LiftNotes backup',
  });
}
