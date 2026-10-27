import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { backupSummary } from '../../backupValidation';
import { s } from '../../styles';
import { C } from '../../theme';
import type { AppData } from '../../types';
import { Button, confirmAction, showAlert } from '../../ui';
import { useBackupRestore } from '../../useBackupRestore';
import { fs } from './styles';

type SafetyCopy = { filename: string; storedValue: string | null };

export function RestoreBackupModal({ backup, onClose }: { backup: AppData; onClose: () => void }) {
  const { exportSafetyCopy, restoreBackup } = useBackupRestore();
  const [copy, setCopy] = useState<SafetyCopy | null>(null);
  const [saved, setSaved] = useState(false);
  const [operation, setOperation] = useState<'export' | 'restore' | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const summary = backupSummary(backup);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const exportCopy = async () => {
    if (busy.current) return;
    busy.current = true;
    setOperation('export');
    setCopy(null);
    setSaved(false);
    try {
      const result = await exportSafetyCopy();
      if (mounted.current) setCopy(result);
    } catch (error) {
      if (mounted.current)
        showAlert('Safety backup failed', error instanceof Error ? error.message : String(error));
    } finally {
      busy.current = false;
      if (mounted.current) setOperation(null);
    }
  };
  const applyRestore = async () => {
    if (!mounted.current || busy.current || !copy || !saved) return;
    busy.current = true;
    setOperation('restore');
    try {
      await restoreBackup(backup, copy.storedValue);
      if (mounted.current) {
        onClose();
        showAlert(
          'Backup restored',
          'The validated backup has replaced the local data on this device. Keep your separate before-restore safety copy.',
        );
      }
    } catch (error) {
      if (mounted.current) {
        setCopy(null);
        setSaved(false);
        showAlert('Restore failed', error instanceof Error ? error.message : String(error));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setOperation(null);
    }
  };
  const confirmRestore = () => {
    if (busy.current || !copy || !saved) return;
    confirmAction(
      'Replace all local data?',
      'This replaces all current workouts, exercises, routines, and settings. It does not merge them. Continue only if your separate safety copy is saved in Files.',
      () => {
        void applyRestore();
      },
      'Restore',
    );
  };
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy.current) onClose();
      }}
    >
      <SafeAreaView style={s.screen}>
        <View style={s.modalHead}>
          <Pressable onPress={onClose} disabled={operation !== null} accessibilityRole="button">
            <Text style={s.link}>Cancel</Text>
          </Pressable>
          <Text style={s.modalTitle}>Restore backup</Text>
          <View style={{ width: 42 }} />
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.card}>
            <Text style={s.overline}>1 / BACKUP VALIDATED</Text>
            <Text style={fs.restoreSummary}>
              {summary.workouts} {summary.workouts === 1 ? 'workout' : 'workouts'} ·{' '}
              {summary.sets.toLocaleString('en')} {summary.sets === 1 ? 'set' : 'sets'}
            </Text>
            <Text style={s.rowSub}>
              {backup.exercises.length} exercise{' '}
              {backup.exercises.length === 1 ? 'definition' : 'definitions'} · {summary.days}{' '}
              training {summary.days === 1 ? 'day' : 'days'}
            </Text>
            {summary.workouts !== summary.days && (
              <Text style={s.helper}>
                Same-day sessions will merge, retaining their sets, notes, and draft status.
              </Text>
            )}
          </View>
          <View style={fs.restoreWarning}>
            <Text style={fs.restoreWarningTitle}>This replaces your current data</Text>
            <Text style={fs.restoreCopy}>
              Workouts added since this file was exported are not in it. Save a fresh safety copy
              first. Close other LiftNotes windows while restoring.
            </Text>
          </View>
          <Text style={s.overline}>2 / SAVE YOUR CURRENT DATA</Text>
          <Button
            label={
              operation === 'export'
                ? 'Exporting safety copy…'
                : copy
                  ? 'Export a fresh safety copy'
                  : 'Export current data first'
            }
            icon="share-outline"
            onPress={() => {
              void exportCopy();
            }}
            disabled={operation !== null}
          />
          {copy && (
            <View style={s.card}>
              <Text style={fs.restoreFilename}>{copy.filename}</Text>
              <Text style={s.rowSub}>
                Save this separate file in Files. It will not replace your edited import or rotating
                A/B backups.
              </Text>
            </View>
          )}
          <Text style={fs.restoreHint}>
            The app cannot verify that a download was saved. Confirm only after you have saved the
            safety copy in Files.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            aria-checked={saved}
            accessibilityLabel="I saved the separate safety backup in Files"
            accessibilityState={{ checked: saved, disabled: !copy || operation !== null }}
            disabled={!copy || operation !== null}
            onPress={() => setSaved((value) => !value)}
            style={[fs.restoreCheck, saved && { borderColor: C.blue }, !copy && { opacity: 0.5 }]}
          >
            <Ionicons name={saved ? 'checkbox' : 'square-outline'} size={24} color={C.blue} />
            <Text style={fs.restoreCheckText}>I saved the separate safety backup in Files.</Text>
          </Pressable>
          <Text style={s.overline}>3 / REPLACE LOCAL DATA</Text>
          <Button
            kind="danger"
            label={operation === 'restore' ? 'Restoring…' : 'Restore this backup'}
            icon="download-outline"
            disabled={!copy || !saved || operation !== null}
            onPress={confirmRestore}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
