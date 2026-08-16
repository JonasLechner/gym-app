import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AppData } from './types';

export async function exportBackup(data: AppData, slot?: 'A' | 'B') {
  const suffix = slot ? `-${slot}` : '';
  const filename = `LiftNotes-backup${suffix}.json`;
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
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export LiftNotes backup' });
}
