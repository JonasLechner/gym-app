import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { canonicalExercise, englishExerciseName } from './categories';
import { importFitNotesRows, parseFitNotesCsv, type ImportSummary } from './fitnotesImport';
import type { AppData, ExerciseDefinition, ExerciseEntry, Workout } from './types';
import { newId as ids } from './ids';
import { mergeWorkoutsByDate } from './workoutDays';
import { DATA_STORAGE_KEY as KEY } from './workoutStorage';
import {
  assertWorkoutCanBeSaved,
  workoutStoreState as mergeWorkoutStoreState,
} from './workoutState';

export { persistWorkoutOnWeb } from './workoutStorage';
export { today } from './dates';
const EXERCISE_DEFAULTS_VERSION = 1;
const DEFAULT_EXERCISES: [string, string][] = [
  ['Barbell Squat', 'Legs'],
  ['Behind Back Cable Lat Raise 2 Arms', 'Shoulders'],
  ['Cable Crunch', 'Abs'],
  ['Cable Curl', 'Biceps'],
  ['Cable Curl Unilateral', 'Biceps'],
  ['Cable Face Pull', 'Shoulders'],
  ['Cable Fly', 'Chest'],
  ['Cable Overhead Triceps Extension', 'Triceps'],
  ['Deadlift', 'Back'],
  ['Dumbbell Hammer Curl', 'Biceps'],
  ['Dumbbell Preacher Curl', 'Biceps'],
  ['Dumbell Preacher Hammer Curl', 'Biceps'],
  ['EZ-Bar Preacher Curl', 'Biceps'],
  ['Flat Barbell Bench Press', 'Chest'],
  ['Flat Bench Pause Reps', 'Chest'],
  ['Flat Dumbbell Bench Press', 'Chest'],
  ['Hanging Leg Raise', 'Abs'],
  ['High Row Unilat', 'Back'],
  ['Hyper Extension', 'Back'],
  ['Incline Barbell Bench Press', 'Chest'],
  ['Incline Dumbbell Bench Press', 'Chest'],
  ['Lat Pulldown', 'Back'],
  ['Lat Pulldown Close Grip', 'Back'],
  ['Lat Pulldown Machine', 'Back'],
  ['Lateral Dumbbell Raise', 'Shoulders'],
  ['Lateral Machine Raise', 'Shoulders'],
  ['Leg Curl Machine', 'Legs'],
  ['Leg Extension Machine', 'Legs'],
  ['Leg Press', 'Legs'],
  ['Low Row', 'Back'],
  ['Lying Leg Curl Machine', 'Legs'],
  ['Machine Dip', 'Triceps'],
  ['Machine Squat', 'Legs'],
  ['Preacher Hammer Curl', 'Biceps'],
  ['Pull Up', 'Back'],
  ['Pullover', 'Back'],
  ['Pullover Machine', 'Back'],
  ['Reverse Fly Unilateral', 'Shoulders'],
  ['Reverse Lat Pulldown', 'Back'],
  ['Romanian Deadlift', 'Legs'],
  ['Rope Push Down', 'Triceps'],
  ['Seated Cable Row', 'Back'],
  ['Seated Cable Row Unilateral', 'Back'],
  ['Seated Dumbbell Lateral Raise', 'Shoulders'],
  ['Seated Dumbbell Press', 'Shoulders'],
  ['Seated Dumbell Curl', 'Biceps'],
  ['Seated Hammer Curl', 'Biceps'],
  ['Seated Incline Dumbbell Curl', 'Biceps'],
  ['Seated Machine Curl', 'Biceps'],
  ['Seated Machine Fly', 'Chest'],
  ['Seated Row Machine', 'Back'],
  ['Seated Shoulder Press', 'Shoulders'],
  ['Seated Smith Machine Press', 'Shoulders'],
  ['Standing Calf Raise Machine', 'Calves'],
  ['T-Bar Row', 'Back'],
  ['Triceps Kickbacks', 'Triceps'],
  ['Unilateral Triceps Extension', 'Triceps'],
];
const initial: AppData = {
  workouts: [],
  exercises: DEFAULT_EXERCISES.map(([name, category]) => ({ id: ids(), name, category })),
  routines: [],
  customCategories: [],
  settings: {
    restSeconds: 120,
    timerEnabled: true,
    backupAfterWorkout: true,
    nextBackupSlot: 'A',
    exerciseDefaultsVersion: EXERCISE_DEFAULTS_VERSION,
  },
};
export type Store = {
  data: AppData;
  ready: boolean;
  saveWorkout: (w: Workout, webSnapshot?: AppData) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (name: string, category: string) => ExerciseDefinition;
  addCategory: (name: string, color: string) => void;
  deleteExercise: (id: string) => void;
  updateSettings: (patch: Partial<AppData['settings']>) => void;
  setRoutines: (r: AppData['routines']) => void;
  importCsv: (csv: string) => { workouts: number; sets: number; duplicates: number };
  replaceData: (d: AppData) => void;
};
const Context = createContext<Store | null>(null);

export function workoutStoreState(data: AppData, workout: Workout, webSnapshot?: AppData): AppData {
  return mergeWorkoutStoreState(data, workout, webSnapshot, ids);
}

function normalize(raw: Partial<AppData>): AppData {
  const workouts = mergeWorkoutsByDate(
    (raw.workouts ?? []).map((w) => {
      const merged = new Map<string, ExerciseEntry>();
      w.exercises.forEach((e) => {
        const fixed = canonicalExercise(e.name, e.category);
        const key = fixed.name.toLowerCase();
        const found = merged.get(key);
        if (found) found.sets.push(...e.sets);
        else merged.set(key, { ...e, ...fixed, sets: [...e.sets] });
      });
      return { ...w, exercises: [...merged.values()] };
    }),
    ids,
  );
  const definitions = new Map<string, ExerciseDefinition>();
  if ((raw.settings?.exerciseDefaultsVersion ?? 0) < EXERCISE_DEFAULTS_VERSION)
    DEFAULT_EXERCISES.forEach(([name, category]) =>
      definitions.set(name.toLowerCase(), { id: ids(), name, category }),
    );
  (raw.exercises ?? []).forEach((e) => {
    const fixed = canonicalExercise(e.name, e.category);
    definitions.set(fixed.name.toLowerCase(), { ...e, ...fixed });
  });
  workouts.forEach((w) =>
    w.exercises.forEach((e) => {
      if (!definitions.has(e.name.toLowerCase()))
        definitions.set(e.name.toLowerCase(), { id: ids(), name: e.name, category: e.category });
    }),
  );
  return {
    ...initial,
    ...raw,
    workouts,
    exercises: [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    routines: raw.routines ?? [],
    customCategories: raw.customCategories ?? [],
    settings: {
      ...initial.settings,
      ...raw.settings,
      exerciseDefaultsVersion: EXERCISE_DEFAULTS_VERSION,
    },
  };
}

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
        const fixed = canonicalExercise(englishExerciseName(name), category);
        const e = { id: ids(), ...fixed };
        setData((d) => ({
          ...d,
          exercises: [...d.exercises, e].sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return e;
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
      replaceData: (next) => setData(normalize(next)),
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
