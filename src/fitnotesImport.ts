import Papa from 'papaparse';
import { canonicalExercise, englishExerciseName } from './categories';
import type { AppData } from './types';

export type ImportSummary = { workouts: number; sets: number; duplicates: number };
export type FitNotesRow = Record<string, string>;
const REQUIRED_COLUMNS = ['Date', 'Exercise', 'Category', 'Weight', 'Weight Unit', 'Reps'];

export function parseFitNotesCsv(csv: string): FitNotesRow[] {
  const parsed = Papa.parse<FitNotesRow>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length && !parsed.data.length)
    throw new Error(parsed.errors[0]?.message ?? 'Invalid CSV');
  if (!REQUIRED_COLUMNS.every((column) => parsed.meta.fields?.includes(column)))
    throw new Error('This is not a supported FitNotes CSV file.');
  return parsed.data;
}

export function importFitNotesRows(
  current: AppData,
  rows: FitNotesRow[],
  newId: () => string,
): { data: AppData; summary: ImportSummary } {
  const summary: ImportSummary = { workouts: 0, sets: 0, duplicates: 0 };
  const workouts = current.workouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) => ({ ...exercise, sets: [...exercise.sets] })),
  }));
  // Imported sets are completed; never merge them into (or deduplicate against) provisional draft sets.
  const completed = workouts.filter((workout) => !workout.draft);
  const byDate = new Map(completed.map((workout) => [workout.date, workout]));
  const existingCount = new Map<string, number>();
  completed.forEach((workout) =>
    workout.exercises.forEach((exercise) =>
      exercise.sets.forEach((set) => {
        const key = `${workout.date}|${exercise.name}|${set.weight}|${set.reps}|${set.comment ?? ''}`;
        existingCount.set(key, (existingCount.get(key) ?? 0) + 1);
      }),
    ),
  );

  const seenImport = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.Date || !row.Exercise) return;
    const date = row.Date.trim();
    const fixed = canonicalExercise(
      englishExerciseName(row.Exercise),
      row.Category?.trim() || 'Uncategorised',
    );
    const weight = Number(row.Weight) || 0;
    const reps = Number(row.Reps) || 0;
    const comment = row.Comment?.trim() || undefined;
    const key = `${date}|${fixed.name}|${weight}|${reps}|${comment ?? ''}`;
    const occurrence = (seenImport.get(key) ?? 0) + 1;
    seenImport.set(key, occurrence);
    if (occurrence <= (existingCount.get(key) ?? 0)) {
      summary.duplicates++;
      return;
    }

    let workout = byDate.get(date);
    if (!workout) {
      workout = { id: newId(), date, exercises: [] };
      workouts.push(workout);
      byDate.set(date, workout);
      summary.workouts++;
    }
    let exercise = workout.exercises.find((item) => item.name === fixed.name);
    if (!exercise) {
      exercise = { id: newId(), ...fixed, sets: [] };
      workout.exercises.push(exercise);
    }
    exercise.sets.push({ id: newId(), weight, reps, comment });
    summary.sets++;
  });

  const definitions = new Map(
    current.exercises.map((exercise) => [exercise.name.toLowerCase(), exercise]),
  );
  workouts.forEach((workout) =>
    workout.exercises.forEach((exercise) => {
      if (!definitions.has(exercise.name.toLowerCase()))
        definitions.set(exercise.name.toLowerCase(), {
          id: newId(),
          name: exercise.name,
          category: exercise.category,
        });
    }),
  );
  return {
    data: {
      ...current,
      workouts: workouts.sort((a, b) => b.date.localeCompare(a.date)),
      exercises: [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    },
    summary,
  };
}

export function importFitNotesCsv(current: AppData, csv: string, newId: () => string) {
  return importFitNotesRows(current, parseFitNotesCsv(csv), newId);
}
