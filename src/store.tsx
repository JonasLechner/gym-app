import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { canonicalExercise } from './categories';
import type { AppData, ExerciseDefinition, ExerciseEntry, SetEntry, Workout } from './types';

const KEY = '@liftnotes/data/v1';
const initial: AppData = { workouts: [], exercises: [], routines: [], customCategories: [], settings: { restSeconds: 120, timerEnabled: true, backupAfterWorkout: true, nextBackupSlot: 'A' } };
const ids = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const translations: Record<string, string> = {
  // These FitNotes names are intentionally preserved:
  // “Hip Abductor Tritte Innen” and “Hip Abductor Tritte Außen”.
  'Beinpresse': 'Leg Press', 'Kniebeuge': 'Squat', 'Kreuzheben': 'Deadlift',
};
export const englishName = (name: string) => translations[name.trim()] ?? name.trim();

export type Store = {
  data: AppData; ready: boolean;
  saveWorkout: (w: Workout) => void; deleteWorkout: (id: string) => void;
  addExercise: (name: string, category: string) => ExerciseDefinition;
  addCategory: (name: string, color: string) => void;
  deleteExercise: (id: string) => void;
  updateSettings: (patch: Partial<AppData['settings']>) => void;
  setRoutines: (r: AppData['routines']) => void;
  importCsv: (csv: string) => { workouts: number; sets: number; duplicates: number };
  replaceData: (d: AppData) => void;
};
const Context = createContext<Store | null>(null);

function normalize(raw: Partial<AppData>): AppData {
  const workouts=(raw.workouts??[]).map(w=>{const merged=new Map<string,ExerciseEntry>();w.exercises.forEach(e=>{const fixed=canonicalExercise(e.name,e.category);const key=fixed.name.toLowerCase();const found=merged.get(key);if(found)found.sets.push(...e.sets);else merged.set(key,{...e,...fixed,sets:[...e.sets]})});return {...w,exercises:[...merged.values()]}});
  const definitions=new Map<string,ExerciseDefinition>();
  (raw.exercises??[]).forEach(e=>{const fixed=canonicalExercise(e.name,e.category);definitions.set(fixed.name.toLowerCase(),{...e,...fixed})});
  workouts.forEach(w=>w.exercises.forEach(e=>{if(!definitions.has(e.name.toLowerCase()))definitions.set(e.name.toLowerCase(),{id:ids(),name:e.name,category:e.category})}));
  return { ...initial, ...raw, workouts, exercises:[...definitions.values()].sort((a,b)=>a.name.localeCompare(b.name)), routines: raw.routines ?? [], customCategories:raw.customCategories??[], settings: { ...initial.settings, ...raw.settings } };
}

export function StoreProvider({ children }: React.PropsWithChildren) {
  const [data, setData] = useState(initial); const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem(KEY).then(v => { if (v) setData(normalize(JSON.parse(v))); }).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem(KEY, JSON.stringify(data)); }, [data, ready]);
  const api = useMemo<Store>(() => ({
    data, ready,
    saveWorkout: w => setData(d => {
      const workouts = [...d.workouts.filter(x => x.id !== w.id), w].sort((a,b) => b.date.localeCompare(a.date));
      const map = new Map(d.exercises.map(x => [x.name.toLowerCase(), x]));
      w.exercises.forEach(x => { if (!map.has(x.name.toLowerCase())) map.set(x.name.toLowerCase(), { id: ids(), name: x.name, category: x.category }); });
      return { ...d, workouts, exercises: [...map.values()].sort((a,b) => a.name.localeCompare(b.name)) };
    }),
    deleteWorkout: id => setData(d => ({ ...d, workouts: d.workouts.filter(w => w.id !== id) })),
    addExercise: (name, category) => { const fixed=canonicalExercise(englishName(name),category); const e = { id: ids(), ...fixed }; setData(d => ({ ...d, exercises: [...d.exercises, e].sort((a,b) => a.name.localeCompare(b.name)) })); return e; },
    addCategory: (name,color) => setData(d => d.customCategories.some(c=>c.name.toLowerCase()===name.trim().toLowerCase())?d:{...d,customCategories:[...d.customCategories,{id:ids(),name:name.trim(),color}]}),
    deleteExercise: id => setData(d => ({ ...d, exercises: d.exercises.filter(e => e.id !== id) })),
    updateSettings: patch => setData(d => ({ ...d, settings: { ...d.settings, ...patch } })),
    setRoutines: routines => setData(d => ({ ...d, routines })),
    replaceData: next => setData(normalize(next)),
    importCsv: csv => {
      const parsed = Papa.parse<Record<string,string>>(csv, { header: true, skipEmptyLines: true });
      if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0]?.message ?? 'Invalid CSV');
      const required = ['Date','Exercise','Category','Weight','Weight Unit','Reps'];
      if (!required.every(k => parsed.meta.fields?.includes(k))) throw new Error('This is not a supported FitNotes CSV file.');
      const summary = { workouts: 0, sets: 0, duplicates: 0 };
      setData(current => {
        const workouts = current.workouts.map(w => ({ ...w, exercises: w.exercises.map(e => ({ ...e, sets: [...e.sets] })) }));
        const byDate = new Map(workouts.map(w => [w.date, w]));
        const existingCount = new Map<string, number>();
        workouts.forEach(w => w.exercises.forEach(e => e.sets.forEach(s => {
          const k = `${w.date}|${e.name}|${s.weight}|${s.reps}|${s.comment ?? ''}`;
          existingCount.set(k, (existingCount.get(k) ?? 0) + 1);
        })));
        const seenImport = new Map<string, number>();
        for (const row of parsed.data) {
          if (!row.Date || !row.Exercise) continue;
          const date = row.Date.trim(), fixed = canonicalExercise(englishName(row.Exercise),row.Category?.trim() || 'Uncategorised'), name=fixed.name, category=fixed.category;
          const weight = Number(row.Weight) || 0, reps = Number(row.Reps) || 0, comment = row.Comment?.trim() || undefined;
          const key = `${date}|${name}|${weight}|${reps}|${comment ?? ''}`;
          const occurrence = (seenImport.get(key) ?? 0) + 1; seenImport.set(key, occurrence);
          if (occurrence <= (existingCount.get(key) ?? 0)) { summary.duplicates++; continue; }
          let workout = byDate.get(date);
          if (!workout) { workout = { id: ids(), date, exercises: [] }; workouts.push(workout); byDate.set(date, workout); summary.workouts++; }
          let exercise = workout.exercises.find(e => e.name === name);
          if (!exercise) { exercise = { id: ids(), name, category, sets: [] }; workout.exercises.push(exercise); }
          exercise.sets.push({ id: ids(), weight, reps, comment }); summary.sets++;
        }
        const defs = new Map(current.exercises.map(e => [e.name.toLowerCase(), e]));
        workouts.forEach(w => w.exercises.forEach(e => { if (!defs.has(e.name.toLowerCase())) defs.set(e.name.toLowerCase(), { id: ids(), name: e.name, category: e.category }); }));
        return { ...current, workouts: workouts.sort((a,b) => b.date.localeCompare(a.date)), exercises: [...defs.values()].sort((a,b) => a.name.localeCompare(b.name)) };
      });
      return summary;
    },
  }), [data, ready]);
  return <Context.Provider value={api}>{children}</Context.Provider>;
}
export const useStore = () => { const v = useContext(Context); if (!v) throw new Error('Store missing'); return v; };
export const newId = ids;
export const today = () => new Date().toISOString().slice(0,10);
export const prettyDate = (date: string) => { const [y,m,d] = date.split('-'); return `${d}.${m}.${y}`; };
export const volume = (w: Workout) => w.exercises.reduce((a,e) => a + e.sets.reduce((b,s) => b + s.weight*s.reps,0),0);
