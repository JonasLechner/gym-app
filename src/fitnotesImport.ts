import Papa from 'papaparse';
import { canonicalExercise, englishExerciseName } from './categories';
import type { AppData } from './types';
import { mergeWorkoutsByDate } from './workoutDays';

export type ImportSummary = { workouts: number; sets: number; duplicates: number };
export type FitNotesRow = Record<string, string>;
const REQUIRED_COLUMNS = ['Date', 'Exercise', 'Category', 'Weight', 'Weight Unit', 'Reps'];

export function parseFitNotesCsv(csv: string): FitNotesRow[] {
  const parsed = Papa.parse<FitNotesRow>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length && !parsed.data.length)
    throw new Error(parsed.errors[0]?.message ?? 'Invalid CSV');
  if (!REQUIRED_COLUMNS.every((column) => parsed.meta.fields?.includes(column)))
    throw new Error('This is not a supported FitNotes CSV file.');
  validateWeightUnits(parsed.data);
  return parsed.data;
}

function weightInKilograms(row: FitNotesRow): number {
  const weight = Number(row.Weight);
  if (!Number.isFinite(weight) || weight < 0)
    throw new Error(`Invalid weight for ${row.Exercise} on ${row.Date}.`);
  const unit = row['Weight Unit']?.trim().toLowerCase();
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(unit ?? '')) return weight;
  if (['lb', 'lbs', 'pound', 'pounds'].includes(unit ?? ''))
    return Number((weight * 0.45359237).toFixed(6));
  throw new Error(`Unsupported weight unit “${unit || '(missing)'}” for ${row.Exercise}.`);
}

function validateWeightUnits(rows: FitNotesRow[]): void {
  for (const row of rows) {
    if (row.Date && row.Exercise) weightInKilograms(row);
  }
}

export function importFitNotesRows(
  current: AppData,
  rows: FitNotesRow[],
  newId: () => string,
): { data: AppData; summary: ImportSummary } {
  validateWeightUnits(rows);
  const summary: ImportSummary = { workouts: 0, sets: 0, duplicates: 0 };
  const workouts = mergeWorkoutsByDate(current.workouts, newId);
  // Same-day imports share the existing session, retaining draft status until Finish.
  const byDate = new Map(workouts.map((workout) => [workout.date, workout]));
  const existingCount = new Map<string, number>();
  workouts.forEach((workout) =>
    workout.exercises.forEach((exercise) =>
      exercise.sets.forEach((set) => {
        const key = `${workout.date}|${exercise.name.toLowerCase()}|${set.weight}|${set.reps}|${set.comment ?? ''}`;
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
    const weight = weightInKilograms(row);
    const reps = Number(row.Reps) || 0;
    const comment = row.Comment?.trim() || undefined;
    const key = `${date}|${fixed.name.toLowerCase()}|${weight}|${reps}|${comment ?? ''}`;
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
    let exercise = workout.exercises.find(
      (item) => item.name.toLowerCase() === fixed.name.toLowerCase(),
    );
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
