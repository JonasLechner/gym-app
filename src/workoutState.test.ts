import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppData, Workout } from './types';
import { withSavedWorkout, workoutSaveError, workoutStoreState } from './workoutState';
import { DATA_STORAGE_KEY, persistWorkoutOnWeb } from './workoutStorage';

const workout = (id = 'workout', date = '2026-01-02'): Workout => ({
  id,
  date,
  draft: true,
  note: 'Keep this note',
  exercises: [
    { id: 'entry', name: 'Bench', category: 'Chest', sets: [{ id: 'set', weight: 60, reps: 8 }] },
  ],
});
const data = (): AppData => ({
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
const unexpectedId = () => {
  throw new Error('Existing definitions must not generate IDs');
};

test('empty completed workouts are rejected by every save boundary without changing data', () => {
  for (const draft of [false, undefined]) {
    for (const exercises of [[], [{ ...workout().exercises[0]!, sets: [] }]]) {
      const empty: Workout = { ...workout(), draft, exercises };
      const original = data();
      original.workouts = [{ ...workout(), draft: false }];
      const before = structuredClone(original);
      const snapshot = structuredClone(original);
      const expected = {
        message: 'A completed workout needs at least one set. Use Delete workout to remove it.',
      };
      assert.equal(workoutSaveError(empty), expected.message);
      assert.throws(() => withSavedWorkout(original, empty, unexpectedId), expected);
      assert.throws(() => workoutStoreState(original, empty, undefined, unexpectedId), expected);
      assert.throws(() => workoutStoreState(original, empty, snapshot, unexpectedId), expected);
      assert.throws(
        () =>
          persistWorkoutOnWeb(original, empty, {
            getItem: () => assert.fail('Invalid saves must not access storage'),
            setItem: () => assert.fail('Invalid saves must not write storage'),
          }),
        expected,
      );
      assert.deepEqual(original, before);
      assert.deepEqual(snapshot, before);
    }
  }
});

test('empty drafts remain savable through state and web persistence', () => {
  for (const exercises of [[], [{ ...workout().exercises[0]!, sets: [] }]]) {
    const empty: Workout = { ...workout(), draft: true, exercises };
    assert.equal(workoutSaveError(empty), null);
    const result = workoutStoreState(data(), empty, undefined, () => 'definition');
    assert.deepEqual(result.workouts, [empty]);
    let written: AppData | undefined;
    const snapshot = persistWorkoutOnWeb(data(), empty, {
      getItem: () => null,
      setItem: (_key, value) => {
        written = JSON.parse(value);
      },
    });
    assert.deepEqual(written?.workouts, [empty]);
    assert.equal(workoutStoreState(data(), empty, snapshot, unexpectedId), snapshot);
  }
});

test('completed workouts need a set, not positive weight or reps in that set', () => {
  const completed: Workout = {
    ...workout(),
    draft: false,
    exercises: [
      { ...workout().exercises[0]!, sets: [] },
      { id: 'second', name: 'Squat', category: 'Legs', sets: [{ id: 'zero', weight: 0, reps: 0 }] },
    ],
  };
  assert.equal(workoutSaveError(completed), null);
  assert.equal(withSavedWorkout(data(), completed, () => 'id').workouts[0], completed);
});

test('saving replaces only the matching workout and sorts dates without mutating input', () => {
  const original = data();
  original.workouts = [workout('older', '2026-01-01'), workout()];
  const before = structuredClone(original);
  const edited = { ...workout(), date: '2026-01-03', draft: false };
  const result = withSavedWorkout(original, edited, () => 'definition');
  assert.deepEqual(original, before);
  assert.deepEqual(
    result.workouts.map((w) => w.id),
    ['workout', 'older'],
  );
  assert.equal(result.workouts[0], edited);
  assert.equal(result.settings, original.settings);
  assert.equal(result.routines, original.routines);
  assert.deepEqual(result.exercises, [{ id: 'definition', name: 'Bench', category: 'Chest' }]);
});

test('definitions are case-insensitive and existing IDs and categories are retained', () => {
  const original = data();
  original.exercises = [{ id: 'existing', name: 'bench', category: 'Custom' }];
  const result = withSavedWorkout(original, workout(), unexpectedId);
  assert.deepEqual(result.exercises, original.exercises);
});

test('new definitions are deduplicated and sorted by name', () => {
  const edited = workout();
  edited.exercises.push(
    { id: 'second', name: 'bench', category: 'Other', sets: [] },
    { id: 'third', name: 'Ab crunch', category: 'Abs', sets: [] },
  );
  let id = 0;
  const result = withSavedWorkout(data(), edited, () => `id-${++id}`);
  assert.deepEqual(
    result.exercises.map((e) => e.name),
    ['Ab crunch', 'Bench'],
  );
  assert.equal(id, 2);
});

test('native store update uses the same workout merge', () => {
  const original = data();
  const edited = workout();
  assert.deepEqual(
    workoutStoreState(original, edited, undefined, () => 'id'),
    withSavedWorkout(original, edited, () => 'id'),
  );
});

test('web snapshot is authoritative except for relevant categories created in the same event', () => {
  const original = data();
  original.customCategories = [
    { id: 'chest', name: 'Chest', color: '#123456' },
    { id: 'unrelated', name: 'Unrelated', color: '#abcdef' },
  ];
  const snapshot = data();
  snapshot.workouts = [workout(), workout('other-tab', '2026-01-01')];
  snapshot.settings.restSeconds = 180;
  const before = structuredClone(snapshot);
  const result = workoutStoreState(original, workout(), snapshot, unexpectedId);
  assert.equal(result.workouts, snapshot.workouts);
  assert.equal(result.settings, snapshot.settings);
  assert.deepEqual(result.customCategories, [original.customCategories[0]]);
  assert.deepEqual(snapshot, before);
  snapshot.customCategories = [original.customCategories[0]!];
  assert.equal(workoutStoreState(original, workout(), snapshot, unexpectedId), snapshot);
});

test('web persistence reads latest storage instead of overwriting unrelated changes with stale data', () => {
  const stale = data();
  const latest = data();
  latest.workouts = [workout('other-tab', '2026-01-01')];
  latest.settings.restSeconds = 180;
  const writes: [string, string][] = [];
  const result = persistWorkoutOnWeb(stale, workout(), {
    getItem: (key) => {
      assert.equal(key, DATA_STORAGE_KEY);
      return JSON.stringify(latest);
    },
    setItem: (key, value) => {
      writes.push([key, value]);
    },
  });
  assert.equal(result.workouts.length, 2);
  assert.equal(result.settings.restSeconds, 180);
  assert.deepEqual(writes, [[DATA_STORAGE_KEY, JSON.stringify(result)]]);
  assert.equal(stale.workouts.length, 0);
});

test('only absent storage uses the in-memory state', () => {
  const original = data();
  original.settings.restSeconds = 90;
  const result = persistWorkoutOnWeb(original, workout(), {
    getItem: () => null,
    setItem: () => {},
  });
  assert.equal(result.settings.restSeconds, 90);
  assert.equal(result.workouts[0]?.draft, true);
  assert.equal(result.workouts[0]?.note, 'Keep this note');
});

test('malformed storage throws without attempting a write', () => {
  for (const stored of ['not json', '', 'null', '{}']) {
    let writes = 0;
    assert.throws(() =>
      persistWorkoutOnWeb(data(), workout(), {
        getItem: () => stored,
        setItem: () => {
          writes++;
        },
      }),
    );
    assert.equal(writes, 0);
  }
});

test('storage read and write failures propagate unchanged', () => {
  const error = new Error('Storage unavailable');
  assert.throws(
    () =>
      persistWorkoutOnWeb(data(), workout(), {
        getItem: () => {
          throw error;
        },
        setItem: () => {
          assert.fail('Must not write after failed read');
        },
      }),
    (caught) => caught === error,
  );
  assert.throws(
    () =>
      persistWorkoutOnWeb(data(), workout(), {
        getItem: () => null,
        setItem: () => {
          throw error;
        },
      }),
    (caught) => caught === error,
  );
});
