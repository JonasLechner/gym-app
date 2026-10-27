import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AppData } from './types';

export async function exportBackup(data: AppData, slot?: 'A' | 'B') {
  const suffix = slot ? `-${slot}` : '';
  await exportBackupFile(data, `LiftNotes-backup${suffix}.json`);
}

/** Distinct from the edited import file and rotating A/B backups. */
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
    browser.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => browser.URL.revokeObjectURL(url), 1000);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, json);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export LiftNotes backup',
  });
}
