import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialData, normalizeAppData } from './appData';
import { validateBackup } from './backupValidation';
import { coreLiftsForExercises } from './coreLifts';
import { exerciseFields, exerciseLookup, withEditedExercise } from './exercises';
import { exerciseHistory } from './features/exercises/exerciseHistory';
import { bigThreeTotal, personalRecords } from './features/records/personalRecords';
import { importFitNotesRows } from './fitnotesImport';
import type { AppData, ExerciseDefinition } from './types';
import { withSavedWorkout } from './workoutState';
import { persistWorkoutOnWeb } from './workoutStorage';

const definition: ExerciseDefinition = { id: 'squat', name: 'Barbell Squat', category: 'Legs' };
const fixture = (): AppData => ({
  workouts: [
    {
      id: 'completed',
      date: '2026-01-01',
      note: 'Keep this workout note',
      exercises: [
        {
          id: 'squat-entry',
          name: definition.name,
          category: definition.category,
          sets: [
            { id: 'squat-1', weight: 60.25, reps: 8, comment: 'Keep this comment' },
            { id: 'squat-2', weight: 80, reps: 5 },
          ],
        },
        {
          id: 'variant-entry',
          name: 'Front Squat',
          category: 'Legs',
          sets: [{ id: 'front-1', weight: 40, reps: 6 }],
        },
        {
          id: 'bench-entry',
          name: 'Flat Barbell Bench Press',
          category: 'Chest',
          sets: [{ id: 'bench-1', weight: 70, reps: 8 }],
        },
        {
          id: 'deadlift-entry',
          name: 'Deadlift',
          category: 'Back',
          sets: [{ id: 'deadlift-1', weight: 100, reps: 6 }],
        },
        {
          id: 'inside-entry',
          name: 'Hip Abductor Tritte Innen',
          category: 'Legs',
          sets: [{ id: 'inside-1', weight: 30, reps: 12 }],
        },
        {
          id: 'outside-entry',
          name: 'Hip Abductor Tritte Außen',
          category: 'Legs',
          sets: [{ id: 'outside-1', weight: 40, reps: 12 }],
        },
      ],
    },
    {
      id: 'draft',
      date: '2026-01-02',
      draft: true,
      note: 'Draft note',
      exercises: [
        {
          id: 'draft-entry',
          name: '  barbell squat  ',
          category: 'Other',
          sets: [{ id: 'draft-set', weight: 82.5, reps: 4, comment: 'Draft comment' }],
        },
      ],
    },
    {
      id: 'empty-draft',
      date: '2026-01-03',
      draft: true,
      exercises: [{ id: 'empty-entry', name: 'BARBELL SQUAT', category: 'Legs', sets: [] }],
    },
  ],
  exercises: [
    { ...definition },
    { id: 'front', name: 'Front Squat', category: 'Legs' },
    { id: 'bench', name: 'Flat Barbell Bench Press', category: 'Chest' },
    { id: 'deadlift', name: 'Deadlift', category: 'Back' },
    { id: 'inside', name: 'Hip Abductor Tritte Innen', category: 'Legs' },
    { id: 'outside', name: 'Hip Abductor Tritte Außen', category: 'Legs' },
  ],
  routines: [{ id: 'routine', name: 'A', exerciseIds: ['squat', 'front'] }],
  customCategories: [{ id: 'custom', name: 'Custom legs', color: '#123456' }],
  settings: {
    restSeconds: 120,
    timerEnabled: true,
    backupAfterWorkout: true,
    exerciseDefaultsVersion: 1,
  },
});
const unexpectedId = () => {
  throw new Error('No replacement IDs should be generated');
};
const inventory = (data: AppData) =>
  data.workouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map(({ id, sets }) => ({ id, sets })),
  }));
const edited = (source = fixture()) =>
  withEditedExercise(source, 'squat', { name: 'My Squat', category: 'Custom legs' });

test('editing rewrites all matching completed and draft entries without touching sets or other variants', () => {
  const source = fixture();
  const before = structuredClone(source);
  const next = edited(source);
  assert.deepEqual(source, before);
  assert.deepEqual(inventory(next), inventory(source));
  assert.deepEqual(
    next.exercises.find((exercise) => exercise.id === 'squat'),
    {
      id: 'squat',
      name: 'My Squat',
      category: 'Custom legs',
      customized: true,
      aliases: ['Barbell Squat'],
    },
  );
  for (const workout of next.workouts) {
    assert.equal(workout.exercises[0]?.name, 'My Squat');
    assert.equal(workout.exercises[0]?.category, 'Custom legs');
  }
  assert.equal(next.workouts[0]?.exercises[0]?.sets, source.workouts[0]?.exercises[0]?.sets);
  assert.equal(next.workouts[0]?.exercises[1], source.workouts[0]?.exercises[1]);
  assert.equal(next.workouts[0]?.exercises[4]?.name, 'Hip Abductor Tritte Innen');
  assert.equal(next.workouts[0]?.exercises[5]?.name, 'Hip Abductor Tritte Außen');
  assert.equal(next.routines, source.routines);
  assert.equal(next.settings, source.settings);
  assert.equal(next.customCategories, source.customCategories);
  assert.deepEqual(
    next.exercises.map((exercise) => exercise.name),
    next.exercises.map((exercise) => exercise.name).sort((a, b) => a.localeCompare(b)),
  );
});

test('history and completed-only core records survive a rename and backup/reload round trip', () => {
  const source = fixture();
  const next = normalizeAppData(
    validateBackup(JSON.parse(JSON.stringify(edited(source)))),
    unexpectedId,
  );
  const before = personalRecords(source.workouts, definition.name);
  const after = personalRecords(next.workouts, 'My Squat');
  assert.deepEqual(after, before);
  assert.equal(after.heaviest?.weight, 80);
  assert.equal(after.sessions, 1);
  assert.deepEqual(
    exerciseHistory(next.workouts, 'My Squat').map((day) => day.sets.length),
    [1, 2],
  );
  const lifts = coreLiftsForExercises(next.exercises).map((lift) => ({
    ...lift,
    ...personalRecords(next.workouts, lift.exerciseName),
  }));
  assert.equal(lifts[0]?.exerciseName, 'My Squat');
  assert.equal(bigThreeTotal(lifts), 250);
  assert.deepEqual(normalizeAppData(next, unexpectedId), next);
  assert.deepEqual(next.routines, source.routines);
});

test('name casing and whitespace edits use the same identity and do not leave duplicate aliases', () => {
  const source = fixture();
  const next = withEditedExercise(source, 'squat', {
    name: '  BARBELL squat  ',
    category: ' Legs ',
  });
  assert.equal(next.exercises.find((exercise) => exercise.id === 'squat')?.name, 'BARBELL squat');
  assert.equal(next.exercises.find((exercise) => exercise.id === 'squat')?.aliases, undefined);
  assert.equal(next.workouts[1]?.exercises[0]?.name, 'BARBELL squat');
  assert.doesNotThrow(() => validateBackup(next));
});

test('repeated renames and renaming back keep all former names attached to the same ID', () => {
  const first = edited();
  const second = withEditedExercise(first, 'squat', { name: 'Squat training', category: 'Legs' });
  const third = withEditedExercise(second, 'squat', { name: 'Barbell Squat', category: 'Legs' });
  const result = third.exercises.find((exercise) => exercise.id === 'squat')!;
  assert.deepEqual(result.aliases, ['My Squat', 'Squat training']);
  for (const name of ['My Squat', 'Squat training', 'barbell squat'])
    assert.equal(exerciseLookup(third.exercises).get(name.toLowerCase())?.id, 'squat');
  assert.deepEqual(inventory(third), inventory(fixture()));
  assert.doesNotThrow(() => validateBackup(third));
});

test('no-op edits do not change state or introduce metadata', () => {
  const source = fixture();
  assert.equal(
    withEditedExercise(source, 'squat', { name: ' Barbell Squat ', category: ' Legs ' }),
    source,
  );
});

for (const [name, category, expected] of [
  ['', 'Legs', /Enter an exercise name/],
  ['  ', 'Legs', /Enter an exercise name/],
  ['My Squat', ' ', /Choose a muscle group/],
  ['Front Squat', 'Legs', /already uses this name/],
  ['  FRONT squat  ', 'Legs', /already uses this name/],
] as const) {
  test(`invalid or conflicting edit ${JSON.stringify([name, category])} leaves the database intact`, () => {
    const source = fixture();
    const before = structuredClone(source);
    assert.throws(() => withEditedExercise(source, 'squat', { name, category }), expected);
    assert.deepEqual(source, before);
  });
}

test('names reserved by another renamed exercise cannot be reused accidentally', () => {
  const source = withEditedExercise(fixture(), 'front', {
    name: 'Front squat new',
    category: 'Legs',
  });
  assert.throws(
    () => withEditedExercise(source, 'squat', { name: 'Front Squat', category: 'Legs' }),
    /used it before/,
  );
});

test('conflicting workout entries without a definition cannot be merged by a rename', () => {
  const source = fixture();
  source.workouts[0]!.exercises.push({
    id: 'orphan',
    name: 'Orphan exercise',
    category: 'Legs',
    sets: [],
  });
  assert.throws(
    () => withEditedExercise(source, 'squat', { name: 'Orphan exercise', category: 'Legs' }),
    /Another exercise in your workouts/,
  );
});

test('editing a deleted definition fails instead of creating a replacement', () => {
  assert.throws(
    () => withEditedExercise(fixture(), 'missing', { name: 'New', category: 'Legs' }),
    /no longer exists/,
  );
});

test('explicit muscle-group and legacy-alias edits are not undone by reload/restore', () => {
  let id = 0;
  const source = createInitialData(() => `default-${++id}`);
  const face = source.exercises.find((exercise) => exercise.name === 'Cable Face Pull')!;
  const next = withEditedExercise(source, face.id, { name: 'Face Pull', category: 'Back' });
  const loaded = normalizeAppData(validateBackup(next), unexpectedId);
  assert.equal(loaded.exercises.find((exercise) => exercise.id === face.id)?.name, 'Face Pull');
  assert.equal(loaded.exercises.find((exercise) => exercise.id === face.id)?.category, 'Back');
  assert.deepEqual(
    exerciseFields('Cable Face Pull', 'Shoulders', exerciseLookup(loaded.exercises)),
    { name: 'Face Pull', category: 'Back' },
  );
  const calf = source.exercises.find(
    (exercise) => exercise.name === 'Standing Calf Raise Machine',
  )!;
  const categoryOnly = withEditedExercise(source, calf.id, { name: calf.name, category: 'Legs' });
  assert.equal(
    normalizeAppData(categoryOnly, unexpectedId).exercises.find(
      (exercise) => exercise.id === calf.id,
    )?.category,
    'Legs',
  );
});

test('legacy defaults migration does not resurrect an old name claimed by a renamed exercise', () => {
  const next = edited();
  next.settings.exerciseDefaultsVersion = 0;
  let id = 0;
  const loaded = normalizeAppData(next, () => `new-${++id}`);
  assert.equal(loaded.exercises.filter((exercise) => exercise.name === 'Barbell Squat').length, 0);
  assert.equal(loaded.exercises.find((exercise) => exercise.id === 'squat')?.name, 'My Squat');
  assert.equal(coreLiftsForExercises(loaded.exercises)[0]?.exerciseName, 'My Squat');
  assert.doesNotThrow(() => validateBackup(loaded));
});

test('old autosaves resolve renamed exercise names and categories against latest storage', () => {
  const source = fixture();
  const latest = edited(source);
  const staleWorkout = structuredClone(source.workouts[1]!);
  staleWorkout.exercises[0]!.sets[0]!.reps = 10;
  const saved = withSavedWorkout(latest, staleWorkout, unexpectedId);
  assert.equal(
    saved.workouts.find((workout) => workout.id === 'draft')?.exercises[0]?.name,
    'My Squat',
  );
  assert.equal(
    saved.workouts.find((workout) => workout.id === 'draft')?.exercises[0]?.category,
    'Custom legs',
  );
  assert.equal(
    saved.workouts.find((workout) => workout.id === 'draft')?.exercises[0]?.sets[0]?.reps,
    10,
  );
  assert.equal(saved.exercises.length, source.exercises.length);
  const web = persistWorkoutOnWeb(source, staleWorkout, {
    getItem: () => JSON.stringify(latest),
    setItem: () => {},
  });
  assert.deepEqual(web, saved);
});

test('old legacy-alias autosaves cannot undo a renamed canonical exercise', () => {
  const source = fixture();
  source.exercises.push({ id: 'face', name: 'Cable Face Pull', category: 'Shoulders' });
  const next = withEditedExercise(source, 'face', { name: 'Rope Face Pull', category: 'Back' });
  const stale = {
    id: 'old-face-draft',
    date: '2026-01-04',
    draft: true,
    exercises: [{ id: 'face-entry', name: 'Face Pull', category: 'Shoulders', sets: [] }],
  };
  const saved = withSavedWorkout(next, stale, unexpectedId);
  assert.equal(saved.workouts[0]?.exercises[0]?.name, 'Rope Face Pull');
  assert.equal(saved.workouts[0]?.exercises[0]?.category, 'Back');
  assert.equal(saved.exercises.length, next.exercises.length);
  assert.doesNotThrow(() => validateBackup(saved));
});

test('CSV imports using former names remain duplicate-aware and new rows use edited fields', () => {
  const source = fixture();
  const rows = source.workouts[0]!.exercises[0]!.sets.map((set) => ({
    Date: '2026-01-01',
    Exercise: 'Barbell Squat',
    Category: 'Legs',
    Weight: String(set.weight),
    'Weight Unit': 'kg',
    Reps: String(set.reps),
    Comment: set.comment ?? '',
  }));
  let id = 0;
  const next = edited(source);
  const duplicate = importFitNotesRows(next, rows, () => `new-${++id}`);
  assert.deepEqual(duplicate.summary, { workouts: 0, sets: 0, duplicates: 2 });
  const imported = importFitNotesRows(
    next,
    [{ ...rows[0]!, Date: '2026-01-04' }],
    () => `new-${++id}`,
  );
  assert.deepEqual(imported.summary, { workouts: 1, sets: 1, duplicates: 0 });
  assert.equal(imported.data.workouts[0]?.exercises[0]?.name, 'My Squat');
  assert.equal(imported.data.workouts[0]?.exercises[0]?.category, 'Custom legs');
  assert.equal(imported.data.exercises.length, source.exercises.length);
});

test('explicit names take precedence over legacy German CSV translation', () => {
  const next = withEditedExercise(fixture(), 'squat', { name: 'Beinpresse', category: 'Legs' });
  let id = 0;
  const imported = importFitNotesRows(
    next,
    [
      {
        Date: '2026-01-04',
        Exercise: 'Beinpresse',
        Category: 'Legs',
        Weight: '80',
        'Weight Unit': 'kg',
        Reps: '5',
      },
    ],
    () => `new-${++id}`,
  );
  assert.equal(imported.data.workouts[0]?.exercises[0]?.name, 'Beinpresse');
  assert.equal(imported.data.exercises.length, next.exercises.length);
});

test('legacy exercise corrections and same-day migration still work without explicit edits', () => {
  const source = fixture();
  source.exercises.push({ id: 'face', name: 'Face Pull', category: 'Back' });
  source.workouts.push({
    id: 'same-day',
    date: '2026-01-01',
    draft: true,
    note: 'More notes',
    exercises: [
      {
        id: 'face-entry',
        name: 'face pull',
        category: 'Back',
        sets: [{ id: 'face-set', weight: 15, reps: 10 }],
      },
    ],
  });
  const result = normalizeAppData(source, unexpectedId);
  assert.equal(result.workouts.length, 3);
  const day = result.workouts.find((workout) => workout.date === '2026-01-01')!;
  assert.equal(day.draft, true);
  assert.equal(day.exercises.at(-1)?.name, 'Cable Face Pull');
  assert.equal(day.exercises.at(-1)?.category, 'Shoulders');
  assert.ok(day.note?.includes('More notes'));
  assert.equal(result.exercises.find((exercise) => exercise.id === 'face')?.category, 'Shoulders');
  assert.doesNotThrow(() => validateBackup(result));
});
