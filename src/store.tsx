import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { englishExerciseName } from './categories';
import { createInitialData, normalizeAppData } from './appData';
import { exerciseFields, exerciseLookup, exerciseNameKey, type ExerciseChanges } from './exercises';
import { writeEditedExercise } from './exerciseStorage';
import { importFitNotesRows, parseFitNotesCsv, type ImportSummary } from './fitnotesImport';
import type { AppData, ExerciseDefinition, Workout } from './types';
import { newId as ids } from './ids';
import { writeRestoredBackup } from './backupRestore';
import { DATA_STORAGE_KEY as KEY } from './workoutStorage';
import {
  assertWorkoutCanBeSaved,
  workoutStoreState as mergeWorkoutStoreState,
} from './workoutState';

export { persistWorkoutOnWeb } from './workoutStorage';
export { today } from './dates';
const initial = createInitialData(ids);
export type Store = {
  data: AppData;
  ready: boolean;
  saveWorkout: (w: Workout, webSnapshot?: AppData) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (name: string, category: string) => ExerciseDefinition;
  updateExercise: (original: ExerciseDefinition, changes: ExerciseChanges) => Promise<void>;
  addCategory: (name: string, color: string) => void;
  deleteExercise: (id: string) => void;
  updateSettings: (patch: Partial<AppData['settings']>) => void;
  setRoutines: (r: AppData['routines']) => void;
  importCsv: (csv: string) => { workouts: number; sets: number; duplicates: number };
  replaceData: (d: AppData, expectedStoredValue: string | null) => Promise<void>;
};
const Context = createContext<Store | null>(null);

export function workoutStoreState(data: AppData, workout: Workout, webSnapshot?: AppData): AppData {
  return mergeWorkoutStoreState(data, workout, webSnapshot, ids);
}

const normalize = (raw: Partial<AppData>): AppData => normalizeAppData(raw, ids);

export function StoreProvider({ children }: React.PropsWithChildren) {
  const [data, setData] = useState(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v) setData(normalize(JSON.parse(v)));
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(data));
  }, [data, ready]);
  const api = useMemo<Store>(
    () => ({
      data,
      ready,
      saveWorkout: (w, webSnapshot) => {
        assertWorkoutCanBeSaved(w, webSnapshot?.workouts ?? data.workouts);
        setData((d) => workoutStoreState(d, w, webSnapshot));
      },
      deleteWorkout: (id) =>
        setData((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) })),
      addExercise: (name, category) => {
        const lookup = exerciseLookup(data.exercises);
        const direct = lookup.get(exerciseNameKey(name));
        if (direct) return direct;
        const translated = englishExerciseName(name);
        const fixed = exerciseFields(translated, category, lookup);
        const existing =
          lookup.get(exerciseNameKey(translated)) ?? lookup.get(exerciseNameKey(fixed.name));
        if (existing) return existing;
        const e = { id: ids(), ...fixed };
        setData((d) => ({
          ...d,
          exercises: [...d.exercises, e].sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return e;
      },
      updateExercise: async (original, changes) => {
        const next = await writeEditedExercise(data, original, changes, AsyncStorage);
        setData(next);
      },
      addCategory: (name, color) =>
        setData((d) =>
          d.customCategories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())
            ? d
            : {
                ...d,
                customCategories: [...d.customCategories, { id: ids(), name: name.trim(), color }],
              },
        ),
      deleteExercise: (id) =>
        setData((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== id) })),
      updateSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      setRoutines: (routines) => setData((d) => ({ ...d, routines })),
      replaceData: async (next, expectedStoredValue) => {
        const restored = await writeRestoredBackup(
          next,
          expectedStoredValue,
          AsyncStorage,
          normalize,
        );
        setData(restored);
      },
      importCsv: (csv) => {
        const rows = parseFitNotesCsv(csv);
        const summary: ImportSummary = { workouts: 0, sets: 0, duplicates: 0 };
        setData((current) => {
          const imported = importFitNotesRows(current, rows, ids);
          Object.assign(summary, imported.summary);
          return imported.data;
        });
        return summary;
      },
    }),
    [data, ready],
  );
  return <Context.Provider value={api}>{children}</Context.Provider>;
}
export const useStore = () => {
  const v = useContext(Context);
  if (!v) throw new Error('Store missing');
  return v;
};
export const newId = ids;
export const prettyDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
};
export const volume = (w: Workout) =>
  w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);
