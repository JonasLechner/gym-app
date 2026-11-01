import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialData, normalizeAppData } from './appData';
import { BACKUP_FILENAME, workoutBackupData } from './backupData';
import { validateBackup } from './backupValidation';
import type { AppData, Workout } from './types';

const fixture = (): AppData => ({
  workouts: [
    {
      id: 'current',
      date: '2026-01-02',
      draft: true,
      note: 'Current note',
      exercises: [
        {
          id: 'current-entry',
          name: 'Barbell Squat',
          category: 'Legs',
          sets: [{ id: 'current-set', weight: 80, reps: 5, comment: 'Keep this comment' }],
        },
      ],
    },
    {
      id: 'older',
      date: '2026-01-01',
      note: 'Older note',
      exercises: [
        {
          id: 'older-entry',
          name: 'Barbell Squat',
          category: 'Legs',
          sets: [{ id: 'older-set', weight: 70.25, reps: 8 }],
        },
      ],
    },
  ],
  exercises: [{ id: 'squat', name: 'Barbell Squat', category: 'Legs' }],
  routines: [{ id: 'routine', name: 'A', exerciseIds: ['squat'] }],
  customCategories: [],
  settings: {
    restSeconds: 120,
    timerEnabled: true,
    backupAfterWorkout: true,
    exerciseDefaultsVersion: 1,
    lastBackupAt: '2026-01-01T12:00:00.000Z',
  },
});
const completed = (data: AppData): Workout => ({ ...data.workouts[0]!, draft: false });
const timestamp = '2026-01-02T12:00:00.000Z';
const unexpectedId = () => {
  throw new Error('No new definition should be created');
};

test('regular backups always use the same unsuffixed filename', () => {
  assert.equal(BACKUP_FILENAME, 'LiftNotes-backup.json');
});

test('initial data and migrated A/B installations no longer contain rotation settings', () => {
  let id = 0;
  assert.equal('nextBackupSlot' in createInitialData(() => `default-${++id}`).settings, false);
  for (const slot of ['A', 'B']) {
    const source = fixture();
    const legacy = { ...source, settings: { ...source.settings, nextBackupSlot: slot } };
    const before = structuredClone(legacy);
    const migrated = normalizeAppData(legacy, unexpectedId);
    assert.deepEqual(migrated, source);
    assert.deepEqual(legacy, before);
    assert.deepEqual(validateBackup(migrated), source);
  }
});

test('workout backups include the completed workout, all other data and the started timestamp', () => {
  const source = fixture();
  const before = structuredClone(source);
  const workout = completed(source);
  workout.exercises = structuredClone(workout.exercises);
  workout.exercises[0]!.sets[0]!.reps = 6;
  const backup = workoutBackupData(source, workout, timestamp, unexpectedId);
  assert.deepEqual(source, before);
  assert.equal(backup.workouts.length, 2);
  assert.equal(backup.workouts[0]?.draft, false);
  assert.equal(backup.workouts[0]?.exercises[0]?.sets[0]?.reps, 6);
  assert.equal(backup.workouts[0]?.exercises[0]?.sets[0]?.comment, 'Keep this comment');
  assert.equal(backup.workouts[1], source.workouts[1]);
  assert.equal(backup.routines, source.routines);
  assert.equal(backup.customCategories, source.customCategories);
  assert.deepEqual(backup.settings, { ...source.settings, lastBackupAt: timestamp });
  assert.deepEqual(validateBackup(backup), backup);
});

test('a workout already persisted on web is not duplicated in the exported backup', () => {
  const source = fixture();
  const workout = completed(source);
  source.workouts[0] = workout;
  const first = workoutBackupData(source, workout, timestamp, unexpectedId);
  const second = workoutBackupData(first, workout, timestamp, unexpectedId);
  assert.deepEqual(second, first);
  assert.equal(first.workouts.filter((item) => item.id === workout.id).length, 1);
});

test('a backup includes exercise definitions introduced by the finished workout', () => {
  const source = fixture();
  const workout = completed(source);
  workout.exercises = [
    ...workout.exercises,
    {
      id: 'bench-entry',
      name: 'Bench',
      category: 'Chest',
      sets: [{ id: 'bench-set', weight: 60, reps: 8 }],
    },
  ];
  const backup = workoutBackupData(source, workout, timestamp, () => 'bench-definition');
  assert.deepEqual(
    backup.exercises.find((item) => item.name === 'Bench'),
    { id: 'bench-definition', name: 'Bench', category: 'Chest' },
  );
  assert.deepEqual(validateBackup(backup), backup);
  assert.equal(source.exercises.length, 1);
});

test('a stale workout name cannot undo exercise edits inside a backup', () => {
  const source = fixture();
  source.exercises[0] = {
    id: 'squat',
    name: 'My Squat',
    category: 'Custom legs',
    customized: true,
    aliases: ['Barbell Squat'],
  };
  const backup = workoutBackupData(source, completed(source), timestamp, unexpectedId);
  assert.equal(backup.workouts[0]?.exercises[0]?.name, 'My Squat');
  assert.equal(backup.workouts[0]?.exercises[0]?.category, 'Custom legs');
  assert.equal(backup.workouts[0]?.exercises[0]?.sets[0]?.id, 'current-set');
  assert.equal(backup.exercises.length, 1);
  assert.deepEqual(backup.exercises, source.exercises);
});

test('invalid empty completed workouts cannot produce an export payload', () => {
  const source = fixture();
  const before = structuredClone(source);
  assert.throws(
    () =>
      workoutBackupData(source, { ...completed(source), exercises: [] }, timestamp, unexpectedId),
    /completed workout needs at least one set/,
  );
  assert.deepEqual(source, before);
});
