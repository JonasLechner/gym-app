import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { importFitNotesCsv, importFitNotesRows, parseFitNotesCsv } from './fitnotesImport';
import type { AppData, Workout } from './types';

const empty = (): AppData => ({
  workouts: [],
  exercises: [],
  routines: [],
  customCategories: [],
  settings: {
    restSeconds: 120,
    timerEnabled: true,
    backupAfterWorkout: true,
    nextBackupSlot: 'A',
    exerciseDefaultsVersion: 1,
  },
});
const header = 'Date,Exercise,Category,Weight,Weight Unit,Reps,Comment';
const csv = (...rows: string[]) => [header, ...rows].join('\n');
const ids = () => {
  let id = 0;
  return () => `id-${++id}`;
};
const session = (id: string, draft = false): Workout => ({
  id,
  date: '2026-01-01',
  draft,
  note: id,
  exercises: [
    {
      id: `${id}-exercise`,
      name: 'Bench',
      category: 'Chest',
      sets: [{ id: `${id}-set`, weight: 60, reps: 8 }],
    },
  ],
});

test('pounds are converted to kilograms before storage and duplicate matching', () => {
  const source = csv('2026-01-01,Bench,Chest,200, lbs ,5,record');
  const first = importFitNotesCsv(empty(), source, ids());
  assert.equal(first.data.workouts[0]?.exercises[0]?.sets[0]?.weight, 90.718474);
  const again = importFitNotesCsv(first.data, source, ids());
  assert.deepEqual(again.summary, { workouts: 0, sets: 0, duplicates: 1 });
  const kg = importFitNotesCsv(first.data, source.replace('200, lbs ', '90.718474,kg'), ids());
  assert.equal(kg.summary.duplicates, 1);
});

test('supported kilogram and pound spellings are case-insensitive', () => {
  for (const unit of ['kg', 'kgs', 'KILOGRAM', 'Kilograms']) {
    const result = importFitNotesCsv(empty(), csv(`2026-01-01,Bench,Chest,20,${unit},5,`), ids());
    assert.equal(result.data.workouts[0]?.exercises[0]?.sets[0]?.weight, 20);
  }
  for (const unit of ['lb', 'LBS', 'pound', 'Pounds']) {
    const result = importFitNotesCsv(empty(), csv(`2026-01-01,Bench,Chest,20,${unit},5,`), ids());
    assert.equal(result.data.workouts[0]?.exercises[0]?.sets[0]?.weight, 9.071847);
  }
});

test('unsupported units and invalid weights reject the entire import without changing data', () => {
  for (const [weight, unit] of [
    ['20', 'stone'],
    ['20', ''],
    ['NaN', 'kg'],
    ['Infinity', 'lbs'],
    ['-1', 'kg'],
  ]) {
    const original = empty();
    original.workouts = [session('draft', true)];
    const before = structuredClone(original);
    const source = csv(
      '2026-01-02,Squat,Legs,100,kg,5,',
      `2026-01-03,Bench,Chest,${weight},${unit},5,`,
    );
    assert.throws(() => parseFitNotesCsv(source), /weight|unit/i);
    assert.throws(() => importFitNotesCsv(original, source, ids()), /weight|unit/i);
    assert.throws(
      () =>
        importFitNotesRows(
          original,
          [{ Date: '2026-01-03', Exercise: 'Bench', Weight: weight!, 'Weight Unit': unit! }],
          ids(),
        ),
      /weight|unit/i,
    );
    assert.deepEqual(original, before);
  }
});

test('imports merge into an existing draft without completing it and are repeatable', () => {
  const original = empty();
  original.workouts = [session('draft', true)];
  const before = structuredClone(original);
  const source = csv('2026-01-01,bench,Chest,65,kgs,6,imported', '2026-01-01,Squat,Legs,100,kg,5,');
  const first = importFitNotesCsv(original, source, ids());
  assert.deepEqual(original, before);
  assert.equal(first.data.workouts.length, 1);
  const merged = first.data.workouts[0]!;
  assert.equal(merged.id, 'draft');
  assert.equal(merged.draft, true);
  assert.equal(merged.note, 'draft');
  assert.equal(merged.exercises.length, 2);
  assert.deepEqual(
    merged.exercises[0]?.sets.map((s) => s.weight),
    [60, 65],
  );
  assert.deepEqual(first.summary, { workouts: 0, sets: 2, duplicates: 0 });
  const again = importFitNotesCsv(first.data, source, ids());
  assert.deepEqual(again.summary, { workouts: 0, sets: 0, duplicates: 2 });
  assert.deepEqual(again.data.workouts, first.data.workouts);
});

test('legacy same-day workouts are merged without dropping identical sets or notes', () => {
  const original = empty();
  original.workouts = [session('completed'), session('draft', true)];
  const imported = importFitNotesCsv(original, csv('2026-01-01,Bench,Chest,70,kg,5,'), ids());
  assert.equal(imported.data.workouts.length, 1);
  assert.equal(imported.data.workouts[0]?.draft, true);
  assert.equal(imported.data.workouts[0]?.note, 'completed\n\ndraft');
  assert.equal(imported.data.workouts[0]?.exercises[0]?.sets.length, 3);
});

test('repeated identical CSV sets retain their multiplicity and reimport is idempotent', () => {
  const source = csv('2026-01-01,Bench,Chest,60,kg,8,', '2026-01-01,Bench,Chest,60,kg,8,');
  const first = importFitNotesCsv(empty(), source, ids());
  assert.equal(first.data.workouts[0]?.exercises[0]?.sets.length, 2);
  assert.equal(importFitNotesCsv(first.data, source, ids()).summary.duplicates, 2);
});

test('the supplied FitNotes export remains supported with one session per day', () => {
  const source = readFileSync(
    new URL('../FitNotes_Export_2026_08_11_13_03_29.csv', import.meta.url),
    'utf8',
  );
  const rows = parseFitNotesCsv(source);
  const first = importFitNotesRows(empty(), rows, ids());
  assert.equal(first.summary.sets, rows.length);
  assert.equal(new Set(first.data.workouts.map((w) => w.date)).size, first.data.workouts.length);
  const names = first.data.exercises.map((e) => e.name);
  assert.ok(names.includes('Hip Abductor Tritte Innen'));
  assert.ok(names.includes('Hip Abductor Tritte Außen'));
  assert.equal(importFitNotesRows(first.data, rows, ids()).summary.duplicates, rows.length);
});
